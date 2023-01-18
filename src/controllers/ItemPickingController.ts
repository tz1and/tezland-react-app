import { Nullable, PickingInfo, TransformNode, Node,
    PointerInfo, Observer, KeyboardInfo, EventState,
    PointerEventTypes, KeyboardEventTypes } from "@babylonjs/core";
import { Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import { grapphQLUser } from "../graphql/user";
import { truncate, truncateAddress } from "../utils/Utils";
import { CollectItemFromProps, DirectoryFormProps, OverlayForm } from "../world/AppControlFunctions";
import ItemNode from "../world/nodes/ItemNode";
import Metadata from "../world/Metadata";
import TeleporterBooth from "../world/nodes/TeleporterBooth";
import BaseUserController from "./BaseUserController";
import { CursorType } from "./GuiController";
import ItemTracker from "./ItemTracker";
import PlayerController from "./PlayerController";
import assert from "assert";
import TokenKey from "../utils/TokenKey";
import TzktAccounts from "../utils/TzktAccounts";
import { Logging } from "../utils/Logging";
import { toWorldLoaction } from "../utils/ItemData";
import EventBus, { LoadFormEvent } from "../utils/eventbus/EventBus";


class ItemInfoGui extends Rectangle {
    private panel: StackPanel;
    private label_name: TextBlock;
    private label_minter: TextBlock;
    private label_price: TextBlock;
    private supply_label: TextBlock;
    private label_instructions: TextBlock;

    private current_token_key = TokenKey.fromNumber(-1, "");
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

    public updateInfo(token_key: TokenKey, current_node: TransformNode, current_item: ItemNode) {
        const isSaved = current_item.itemId.gte(0);

        // If it's a valid token, not a temporarily placed one.
        if (current_item.isValidItem()) {
            // If the item id changed, we need to fetch new metadata to update the title and minter.
            // TODO need to compare both id and fa2
            if (!this.current_token_key.id.eq(token_key.id)) {
                this.current_token_key = token_key;
                this.current_token_supply = -1;

                Metadata.getItemMetadata(this.current_token_key.id.toNumber(), this.current_token_key.fa2).then(itemMetadata => {
                    assert(itemMetadata);
                    this.label_name.text = (isSaved ? "" : "*") + truncate(itemMetadata.name, 18, '\u2026');
                    this.label_minter.text = `By: ${truncateAddress(itemMetadata.minter)}`;
                    TzktAccounts.getAccount(itemMetadata.minter).then(res => {
                        this.label_minter.text = `By: ${res.getNameDisplay()}`;
                    }).catch((e) => {
                        Logging.ErrorDev("Failed to load Tzkt Profile", e);
                    });
                }).catch(() => {
                    this.label_name.text = "Failed to load";
                });

                // TODO: use token key
                grapphQLUser.getItemSupplyAndRoyalties({ id: this.current_token_key.id.toNumber(), fa2: this.current_token_key.fa2 }).then(data => {
                    this.current_token_supply = data.itemToken[0].supply;
                    this.supply_label.text = `${current_item.itemAmount} of ${this.current_token_supply}`;
                }).catch(() => {});
            }

            const forSale: boolean = isSaved && current_item.xtzPerItem !== 0;

            this.label_price.text = !forSale && isSaved ? "" : `${current_item.xtzPerItem === 0 ? "Not collectable." : current_item.xtzPerItem + " \uA729"}`;
            this.supply_label.text = `${current_item.itemAmount} of ${this.current_token_supply > 0 ? this.current_token_supply : '?'}`;
            this.label_instructions.text = !isSaved ? "Press U to save changes." : forSale ? "Right-click to get this item." : "Right-click to show item info.";
        }
        else {
            this.label_name.text = "Imported model";
            this.label_minter.text = "";
            this.supply_label.text = "";
            this.label_price.text = "";
            this.label_instructions.text = "Imported for preview.";
        }

        this.linkWithMesh(current_node);
        this.isVisible = true;
    }
}

export default class ItemPickingController extends BaseUserController {
    private infoGui: ItemInfoGui;
    private current_node: Nullable<TransformNode>;

    private mouseObserver: Observer<PointerInfo>;
    private keyboardObserver: Observer<KeyboardInfo>;

    constructor(playerController: PlayerController) {
        super(playerController);

        this.current_node = null;

        this.infoGui = new ItemInfoGui();
        this.playerController.gui.addControl(this.infoGui);

        this.mouseObserver = this.playerController.scene.onPointerObservable.add(this.mouseInput, PointerEventTypes.POINTERDOWN, true)!;
        this.keyboardObserver = this.playerController.scene.onKeyboardObservable.add(this.keyboardInput, KeyboardEventTypes.KEYDOWN, true)!;
    }

    public override dispose(): void {
        this.playerController.scene.onPointerObservable.remove(this.mouseObserver);
        this.playerController.scene.onKeyboardObservable.remove(this.keyboardObserver);

        this.infoGui.dispose();
    }

    public override updateController(hit: Nullable<PickingInfo>): void {
        if (hit) this.updatePickingGui(hit.pickedMesh, hit.distance);
        else this.updatePickingGui(null, Infinity);
    }

    private getInstanceRoot(node: Nullable<Node>): Nullable<ItemNode | TeleporterBooth> {
        let parent: Nullable<Node> = node;
        while(parent) {
            if (parent instanceof ItemNode) return parent;
            if (parent instanceof TeleporterBooth) return parent;
            parent = parent.parent;
        }
        return null;
    }

    public getCurrentItem(): Nullable<ItemNode> {
        const root = this.getInstanceRoot(this.current_node);

        if (root && root instanceof ItemNode) return root;
        return null;
    }

    public getCurrentTeleporterBooth(): Nullable<TeleporterBooth> {
        const root = this.getInstanceRoot(this.current_node);

        if (root && root instanceof TeleporterBooth) return root;
        return null;
    }

    private updatePickingGui(node: Nullable<TransformNode>, distance: number) {
        // TODO: rethink this and updateInfo, so we can early out when nothing changes
        this.current_node = node;

        // If no current_node or the distance is to great for interacting,
        // disable stuff and early out.
        if(!this.current_node || distance > 20) {
            this.infoGui.isVisible = false;
            this.playerController.gui.setCursor(CursorType.Pointer);
            return;
        }

        // Get the root Node for the current_node.
        const instance_root = this.getInstanceRoot(this.current_node);

        // The root node being null means it's not something the player
        // can pick or interact with.
        if(!instance_root) {
            this.infoGui.isVisible = false;
            this.playerController.gui.setCursor(CursorType.Pointer);
            return;
        }

        // If it's an ItemNode, update the info overlay.
        if (instance_root instanceof ItemNode) {
            this.infoGui.updateInfo(instance_root.tokenKey, this.current_node, instance_root);

            // If it's a teleporter
            if (instance_root.teleporterData) {
                this.playerController.gui.showTeleporterInfo(instance_root.teleporterData);
            }
            else this.playerController.gui.setCursor(CursorType.Pointer);
        }
        // If it's a TeleporterBooth, change the cursor, depending on if we are
        // pointing at the control panel.
        else if (instance_root instanceof TeleporterBooth) {
            if (this.current_node.name === "instance of ControlPanel")
                this.playerController.gui.setCursor(CursorType.Hand);
            else this.playerController.gui.setCursor(CursorType.Pointer);
        }
    }

    // Keyboard controls.
    private keyboardInput = (kbInfo: KeyboardInfo) => {
        if(kbInfo.type === KeyboardEventTypes.KEYDOWN) {
            // TEMP: switch item in inventory
            switch(kbInfo.event.code) {
                case 'Delete': // Mark item for deletion
                    const current_item = this.getCurrentItem();
                    if(current_item) {
                        const place = this.playerController.currentPlace;
                        const player_wallet = this.playerController.game.walletProvider.walletPHK();
                        if(place && (current_item.getOwner() === player_wallet || place.getPermissions.hasModifyAll())) {
                            // If the item is unsaved, remove it directly.
                            if(current_item.itemId.lt(0)) {
                                current_item.dispose();

                                // track removed items.
                                // TODO: set issuer on temp items and avoid code duplication.
                                ItemTracker.trackTempItem(current_item.getPlace().placeKey.id, current_item.tokenKey, -current_item.itemAmount);
                            }
                            // Otherwise mark it for removal.
                            else {
                                current_item.markForRemoval = true;
                                current_item.setEnabled(false);

                                // track removed items.
                                // only track items that go to the players wallet.
                                if (current_item.getOwner() === player_wallet) {
                                    ItemTracker.trackTempItem(current_item.getPlace().placeKey.id, current_item.tokenKey, -current_item.itemAmount);
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
        if (this.current_node && info.type === PointerEventTypes.POINTERDOWN) {
            // button 0 is left click
            if(info.event.button === 0) {
                const instanceRoot = this.getInstanceRoot(this.current_node);

                if(instanceRoot && instanceRoot instanceof TeleporterBooth) {
                    document.exitPointerLock();
                    EventBus.publish("load-form", new LoadFormEvent(OverlayForm.Directory, {
                        mapCoords: [instanceRoot.position.x, instanceRoot.position.z]
                    } as DirectoryFormProps));

                    eventState.skipNextObservers = true;
                }
                else if(instanceRoot && instanceRoot instanceof ItemNode) {
                    if (instanceRoot.teleporterData)
                        this.playerController.game.teleportTo(toWorldLoaction(instanceRoot.teleporterData));
                }
            }
            // button 2 is right click.
            else if(info.event.button === 2) {
                const instanceRoot = this.getCurrentItem();

                if(instanceRoot) {
                    // If it's a valid token, not an imported model.
                    if (instanceRoot.isValidItem()) {
                        document.exitPointerLock();
                        // IMPORTANT! TODO: a bit clumsy, but maybe ok.
                        EventBus.publish("load-form", new LoadFormEvent(OverlayForm.CollectItem, {
                            tokenKey: instanceRoot.tokenKey,
                            placeKey: instanceRoot.getPlace().placeKey,
                            chunkId: instanceRoot.chunkId.toNumber(),
                            itemId: instanceRoot.itemId.toNumber(),
                            issuer: instanceRoot.issuer,
                            xtzPerItem: instanceRoot.xtzPerItem } as CollectItemFromProps));
                    }

                    eventState.skipNextObservers = true;
                }
            }
        }
    }
}