import { Node, Nullable, PointerEventTypes, TransformNode } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Ellipse, Image, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import assert from "assert";
import { truncate, truncateAddress } from "../utils/Utils";
import ItemNode from "../world/ItemNode";
import Metadata from "../world/Metadata";
import { World } from "../world/World";
import handIcon from 'bootstrap-icons/icons/hand-index.svg';
import downloadIcon from 'bootstrap-icons/icons/cloud-download.svg';
import { grapphQLUser } from "../graphql/user";
import { CollectItemFromProps, OverlayForm } from "../world/AppControlFunctions";


class ItemInfoGui {
    private control: Control;

    private panel: StackPanel;
    private label_name: TextBlock;
    private label_minter: TextBlock;
    private label_price: TextBlock;
    private supply_label: TextBlock;
    private label_instructions: TextBlock;

    private current_token_id: number = -1;
    private current_token_supply: number = -1;

    constructor(advancedTexture: AdvancedDynamicTexture) {
        // top level control
        var rect = new Rectangle("ItemInfo");
        rect.widthInPixels = 130;
        rect.heightInPixels = 130 * 3/4;
        rect.cornerRadius = 5;
        rect.thickness = 0;
        rect.color = "black";
        rect.alpha = 0.9;
        rect.background = "#ffffff";
        rect.linkOffsetX = -200;

        this.control = rect;

        // stack panel
        let panel = new StackPanel();
        panel.width = 0.85;
        panel.height = 0.85;
        //panel.logLayoutCycleErrors = true; // TEMP*/
        rect.addControl(panel);

        this.panel = panel;

        // name label
        let label_name = new TextBlock();
        label_name.fontSize = "10px";
        label_name.height = "12px";
        label_name.width = 1;
        label_name.textHorizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_CENTER;
        label_name.textVerticalAlignment = StackPanel.VERTICAL_ALIGNMENT_TOP;
        panel.addControl(label_name);

        this.label_name = label_name;

        // minter label
        let label_minter = new TextBlock();
        label_minter.fontSize = "8px";
        label_minter.height = "32px";
        label_minter.width = 1;
        label_minter.textHorizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(label_minter);

        this.label_minter = label_minter;

        // price label
        let label_price = new TextBlock();
        label_price.fontSize = "8px";
        label_price.height = "10px";
        label_price.width = 1;
        label_price.textHorizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(label_price);
        
        this.label_price = label_price;

        // count/supply label
        let supply_label = new TextBlock();
        supply_label.fontSize = "8px";
        supply_label.height = "10px";
        supply_label.width = 1;
        supply_label.textHorizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(supply_label);
        
        this.supply_label = supply_label;

        // instructions label
        let label_instructions = new TextBlock();
        label_instructions.fontSize = "8px";
        label_instructions.height = "32px";
        label_instructions.width = 1;
        label_instructions.textHorizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(label_instructions);

        this.label_instructions = label_instructions;

        advancedTexture.addControl(rect);

        this.setVisible(false);
    }

    public updateInfo(token_id: number, current_node: TransformNode, current_item: ItemNode) {
        const isSaved = current_item.itemId.gte(0);

        // If the item id changed, we need to fetch new metadata to update the title and minter.
        if (this.current_token_id !== token_id) {
            this.current_token_id = token_id;
            this.current_token_supply = -1;

            Metadata.getItemMetadata(this.current_token_id).then(itemMetadata => {
                this.label_name.text = (isSaved ? "" : "*") + truncate(itemMetadata.name, 18, '\u2026');
                this.label_minter.text = `By: ${truncateAddress(itemMetadata.minter)}`;
            }).catch(() => {
                this.label_name.text = "Failed to load";
            });

            grapphQLUser.getItemSupplyAndRoyalties({ id: this.current_token_id }).then(data => {
                this.current_token_supply = data.itemToken[0].supply;
                this.supply_label.text = `${current_item.itemAmount} of ${this.current_token_supply}`;
            }).catch(() => {});
        }

        const forSale: boolean = isSaved && current_item.xtzPerItem !== 0;

        this.label_price.text = !forSale && isSaved ? "" : `${current_item.xtzPerItem === 0 ? "Not collectable." : current_item.xtzPerItem + " \uA729"}`;
        this.supply_label.text = `${current_item.itemAmount} of ${this.current_token_supply > 0 ? this.current_token_supply : '?'}`;
        this.label_instructions.text = !isSaved ? "Press U to save changes." : forSale ? "Right-click to get this item." : "Right-click to show item info.";

        this.control.linkWithMesh(current_node);
        this.setVisible(true);
    }

    public dispose() {
        this.control.dispose();
    }

    public setVisible(visible: boolean) {
        this.control.isVisible = visible;
    }
}

export enum CursorType {
    Pointer = 0,
    Hand,
    Loading
}

export default class PickingGuiController {

    private world: World;
    private advancedTexture: AdvancedDynamicTexture;
    private current_node: Nullable<TransformNode>;

    private infoGui: ItemInfoGui;

    private cursor: Nullable<Control>;

    constructor(world: World) {
        this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        // todo: get size from canvas?
        this.advancedTexture.idealHeight = 1920;
        this.advancedTexture.idealWidth = 1080;
        // TODO: rendering gui on a different layer requires another camera...
        //assert(this.advancedTexture.layer);
        //this.advancedTexture.layer.layerMask = 0x10000000;

        this.current_node = null;
        this.world = world;

        // pointer actions
        // mouse interaction when locked
        this.world.scene.onPointerObservable.add(async (info, eventState) => {
            // button 2 is right click.
            if (info.type === PointerEventTypes.POINTERDOWN && info.event.button === 2) {
                assert(this.world);
                if(this.current_node) {
                    const instanceRoot = this.getInstanceRoot(this.current_node);

                    if(instanceRoot) {
                        document.exitPointerLock();
                        world.appControlFunctions.loadForm(OverlayForm.CollectItem, {
                            tokenId: instanceRoot.tokenId.toNumber(),
                            placeId: instanceRoot.placeId,
                            itemId: instanceRoot.itemId.toNumber(),
                            issuer: instanceRoot.issuer,
                            xtzPerItem: instanceRoot.xtzPerItem } as CollectItemFromProps);
                    }

                    eventState.skipNextObservers = true;
                }
            }
        }, PointerEventTypes.POINTERDOWN);

        // circle pointer
        this.cursor = this.createCursor(0);
        assert(this.cursor);
        this.advancedTexture.addControl(this.cursor);

        this.infoGui = new ItemInfoGui(this.advancedTexture);

        // crosshair
        /*var hor = new Rectangle();
        hor.widthInPixels = 10;
        hor.heightInPixels = 1;
        hor.background = "white";
        this.advancedTexture.addControl(hor);

        var vert = new Rectangle();
        vert.widthInPixels = 1;
        vert.heightInPixels = 10;
        vert.background = "white";
        this.advancedTexture.addControl(vert);*/
    }

    public dispose() {
        this.current_node = null;

        this.infoGui.dispose();

        this.advancedTexture.dispose();
    }

    private getInstanceRoot(node: Nullable<Node>): Nullable<ItemNode> {
        let parent: Nullable<Node> = node;
        while(parent) {
            if (parent instanceof ItemNode) return parent;
            parent = parent.parent;
        }
        return null;
    }

    public getCurrentItem(): Nullable<ItemNode> {
        return this.getInstanceRoot(this.current_node);
    }

    public updatePickingGui(node: Nullable<TransformNode>, distance: number) {
        assert(this.infoGui);

        if(node === this.current_node) return;

        this.current_node = node;

        if(!this.current_node || distance > 20) {
            this.infoGui.setVisible(false);
            return;
        }

        const current_item = this.getCurrentItem();

        if(!current_item) {
            this.infoGui.setVisible(false);
            return;
        }

        this.infoGui.updateInfo(current_item.tokenId.toNumber(), this.current_node, current_item);
    }

    private createCursor(cursor: CursorType): Control {
        switch (cursor) {
            default:
            case CursorType.Pointer:
                var cursorPoint = new Ellipse();
                cursorPoint.widthInPixels = 4;
                cursorPoint.heightInPixels = 4;
                cursorPoint.color = "white";
                return cursorPoint;

            case CursorType.Hand:
                var cursorHand = new Image(undefined, handIcon);
                cursorHand.widthInPixels = 16;
                cursorHand.heightInPixels = 16;
                cursorHand.color = "white";
                return cursorHand;

            case CursorType.Loading:
                var cursorDownload = new Image(undefined, downloadIcon);
                cursorDownload.widthInPixels = 16;
                cursorDownload.heightInPixels = 16;
                cursorDownload.color = "white";
                return cursorDownload;
        }
    }

    // TODO: improve this to not constantly re-create the cursors.
    public setCursor(cursor: CursorType) {
        if (this.cursor) this.advancedTexture.removeControl(this.cursor);

        this.cursor = this.createCursor(cursor);
        this.advancedTexture.addControl(this.cursor);
    }
}