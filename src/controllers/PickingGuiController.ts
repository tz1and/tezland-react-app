import { Node, Nullable, PointerEventTypes, TransformNode } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Ellipse, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import assert from "assert";
import Contracts from "../tz/Contracts";
import { truncate } from "../utils/Utils";
import Metadata from "../world/Metadata";
import { InstanceMetadata } from "../world/Place";
import { World } from "../world/World";

class ItemInfoGui {
    private control: Control;

    private panel: StackPanel;
    private label_name: TextBlock;
    private label_minter: TextBlock;
    private label_price: TextBlock
    private label_instructions: TextBlock;

    private current_item_id: number = -1;

    constructor(advancedTexture: AdvancedDynamicTexture) {
        // top level control
        var rect = new Rectangle("ItemInfo");
        rect.widthInPixels = 115;
        rect.heightInPixels = 115 * 3/4;
        rect.cornerRadius = 5;
        rect.thickness = 0;
        rect.color = "white";
        rect.alpha = 0.95;
        rect.background = "#6c757d";
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
        label_name.height = "24px";
        label_name.width = 1;
        label_name.textHorizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_CENTER;
        label_name.textVerticalAlignment = StackPanel.VERTICAL_ALIGNMENT_TOP;
        panel.addControl(label_name);

        this.label_name = label_name;

        // minter label
        let label_minter = new TextBlock();
        label_minter.fontSize = "8px";
        label_minter.height = "16px";
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

    public updateInfo(item_id: number, current_node: TransformNode, metadata: InstanceMetadata) {
        if (this.current_item_id !== item_id) {
            this.current_item_id = item_id;

            // updade displayed info.
            (async () => {
                const itemMetadata = await Metadata.getItemMetadata(this.current_item_id);

                const isSaved = metadata.id !== undefined;

                this.label_name.text = (isSaved ? "" : "*") + truncate(itemMetadata.name, 16, '\u2026');

                this.label_minter.text = `By: ${truncate(itemMetadata.minterId, 16, '\u2026')}`;

                const forSale: boolean = isSaved && metadata.xtzPerItem !== 0;

                this.label_price.text = !forSale && isSaved ? "" : `${metadata.itemAmount} Items - ${metadata.xtzPerItem === 0 ? "Not collectable." : metadata.xtzPerItem + " \uA729"}`;

                this.label_instructions.text = !isSaved ? "Press U to save changes." : forSale ? "Right-click to get this item." : "Not collectable.";
            })();
        }

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

export default class PickingGuiController {

    private world: World;
    private advancedTexture: AdvancedDynamicTexture;
    private current_node: Nullable<TransformNode>;

    private infoGui: ItemInfoGui;

    constructor(world: World) {
        this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        // todo: get size from canvas?
        this.advancedTexture.idealHeight = 1920;
        this.advancedTexture.idealWidth = 1080;

        this.current_node = null;
        this.world = world;

        // pointer actions
        // mouse interaction when locked
        this.world.scene.onPointerObservable.add(async (info, eventState) => {
            // button 2 is right click.
            if (info.type === PointerEventTypes.POINTERDOWN && info.event.button === 2) {
                assert(this.world);
                if(this.current_node) {
                    const metadata = this.getInstanceMetadata(this.current_node);

                    if(metadata && metadata.xtzPerItem !== 0) {
                        document.exitPointerLock();
                        Contracts.getItem(this.world.walletProvider, metadata.placeId, metadata.id.toNumber(), metadata.issuer, metadata.xtzPerItem, (completed: boolean) => {
                            // NOTE: subscription handles this, but subscription could take a while to update.
                            if(completed) world.places.get(metadata.placeId)?.loadItems(true);
                        });
                    }

                    eventState.skipNextObservers = true;
                }
            }
        }, PointerEventTypes.POINTERDOWN);

        // circle pointer
        var circ = new Ellipse();
        circ.widthInPixels = 4;
        circ.heightInPixels = 4;
        circ.color = "white";
        this.advancedTexture.addControl(circ);

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

    private getInstanceRoot(node: Nullable<Node>): Nullable<Node> {
        let parent: Nullable<Node> = node;
        while(parent) {
            const metadata = parent.metadata as InstanceMetadata;
            if(metadata && metadata.itemTokenId) return parent;
            parent = parent.parent;
        }
        return null;
    }

    private getInstanceMetadata(node: Node): InstanceMetadata | null {
        const root = this.getInstanceRoot(node);
        if(root) return root.metadata as InstanceMetadata;
        return null;
    }

    public getCurrentItem(): Nullable<Node> {
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

        const metadata = this.getInstanceMetadata(this.current_node);

        if(!metadata) return;

        this.infoGui.updateInfo(metadata.itemTokenId.toNumber(), this.current_node, metadata);
    }
}