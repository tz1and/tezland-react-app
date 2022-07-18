import { Nullable, PickingInfo, TransformNode, Node,
    PointerInfo, Observer, KeyboardInfo, EventState,
    PointerEventTypes, KeyboardEventTypes } from "@babylonjs/core";
import { Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import { grapphQLUser } from "../graphql/user";
import { truncate, truncateAddress } from "../utils/Utils";
import { CollectItemFromProps, OverlayForm } from "../world/AppControlFunctions";
import ItemNode from "../world/ItemNode";
import Metadata from "../world/Metadata";
import BaseUserController from "./BaseUserController";
import ItemTracker from "./ItemTracker";
import PlayerController from "./PlayerController";


class ItemInfoGui extends Rectangle {
    private panel: StackPanel;
    private label_name: TextBlock;
    private label_minter: TextBlock;
    private label_price: TextBlock;
    private supply_label: TextBlock;
    private label_instructions: TextBlock;

    private current_token_id: number = -1;
    private current_token_supply: number = -1;

    constructor() {
        super("ItemInfo");

        // top level control
        this.widthInPixels = 130;
        this.heightInPixels = 130 * 3/4;
        this.cornerRadius = 5;
        this.thickness = 0;
        this.color = "black";
        this.alpha = 0.9;
        this.background = "#ffffff";
        this.linkOffsetX = -200;

        // stack panel
        let panel = new StackPanel();
        panel.width = 0.85;
        panel.height = 0.85;
        //panel.logLayoutCycleErrors = true; // TEMP*/
        this.addControl(panel);

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

        this.isVisible = false;
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

        this.linkWithMesh(current_node);
        this.isVisible = true;
    }
}

export default class ItemPickingController extends BaseUserController {
    private infoGui: ItemInfoGui;
    private current_node: Nullable<TransformNode>;

    private mouseObserver: Nullable<Observer<PointerInfo>>;
    private keyboardObserver: Nullable<Observer<KeyboardInfo>>;

    constructor(playerController: PlayerController) {
        super(playerController);

        this.current_node = null;

        this.infoGui = new ItemInfoGui();
        this.playerController.pickingGui.addControl(this.infoGui);

        this.mouseObserver = null;
        this.keyboardObserver = null;

        // Add the observers with a delay.
        // NOTE: if we don't, they will cause an infinite loop.
        // possibly because of the insertFirst option.
        setTimeout(() => {
            this.mouseObserver = this.playerController.scene.onPointerObservable.add(this.mouseInput, PointerEventTypes.POINTERDOWN, true);
            this.keyboardObserver = this.playerController.scene.onKeyboardObservable.add(this.keyboardInput, KeyboardEventTypes.KEYDOWN, true);
        }, 50);
    }

    public override dispose() {
        this.playerController.scene.onPointerObservable.remove(this.mouseObserver);
        this.playerController.scene.onKeyboardObservable.remove(this.keyboardObserver);

        this.infoGui.dispose();
    }

    public override updateController(hit: Nullable<PickingInfo>): void {
        // TODO: move to picking controller
        if (hit) {
            this.updatePickingGui(hit.pickedMesh, hit.distance);
        }
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

    private updatePickingGui(node: Nullable<TransformNode>, distance: number) {
        if(node === this.current_node) return;

        this.current_node = node;

        if(!this.current_node || distance > 20) {
            this.infoGui.isVisible = false;
            return;
        }

        const current_item = this.getCurrentItem();

        if(!current_item) {
            this.infoGui.isVisible = false;
            return;
        }

        this.infoGui.updateInfo(current_item.tokenId.toNumber(), this.current_node, current_item);
    }

    // Keyboard controls.
    private keyboardInput = (kbInfo: KeyboardInfo) => {
        if(kbInfo.type === KeyboardEventTypes.KEYDOWN) {
            // TEMP: switch item in inventory
            switch(kbInfo.event.code) {
                case 'Delete': // Mark item for deletion
                    const current_item = this.getCurrentItem();
                    if(current_item) {
                        const world = this.playerController.world;
                        const place = world.places.get(current_item.placeId);
                        if(place && (current_item.issuer === world.walletProvider.walletPHK() || place.getPermissions.hasModifyAll())) {
                            // If the item is unsaved, remove it directly.
                            if(current_item.itemId.lt(0)) {
                                current_item.dispose();

                                // track removed items.
                                // TODO: set issuer on temp items and avoid code duplication.
                                ItemTracker.trackTempItem(current_item.placeId, current_item.tokenId.toNumber(), -current_item.itemAmount);
                            }
                            // Otherwise mark it for removal.
                            else {
                                current_item.markForRemoval = true;
                                current_item.setEnabled(false);

                                // track removed items.
                                // only track items that go to the players wallet.
                                if (current_item.issuer === world.walletProvider.walletPHK()) {
                                    ItemTracker.trackTempItem(current_item.placeId, current_item.tokenId.toNumber(), -current_item.itemAmount);
                                }
                            }
                        }
                    }
                    break;
            }
        }
    }

    // pointer actions
    private mouseInput = async (info: PointerInfo, eventState: EventState) => {
        // button 2 is right click.
        if (info.type === PointerEventTypes.POINTERDOWN && info.event.button === 2) {
            if(this.current_node) {
                const instanceRoot = this.getInstanceRoot(this.current_node);

                if(instanceRoot) {
                    document.exitPointerLock();
                    this.playerController.appControlFunctions.loadForm(OverlayForm.CollectItem, {
                        tokenId: instanceRoot.tokenId.toNumber(),
                        placeId: instanceRoot.placeId,
                        itemId: instanceRoot.itemId.toNumber(),
                        issuer: instanceRoot.issuer,
                        xtzPerItem: instanceRoot.xtzPerItem } as CollectItemFromProps);
                }

                eventState.skipNextObservers = true;
            }
        }
    }
}