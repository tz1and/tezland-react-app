import { EventState, IWheelEvent, KeyboardEventTypes,
    KeyboardInfo, Nullable, Observer, PickingInfo,
    PointerEventTypes, PointerInfo, Quaternion, Vector3 } from "@babylonjs/core";
import assert from "assert";
import { Logging } from "../utils/Logging";
import { OverlayForm, PlaceItemFromProps } from "../world/AppControlFunctions";
import ItemNode from "../world/nodes/ItemNode";
import BaseUserController from "./BaseUserController";
import ItemTracker from "./ItemTracker";
import { CursorType } from "./GuiController";
import PlayerController from "./PlayerController";
import TempObjectHelper from "./TempObjectHelper";
import { BaseWorld } from "../world/BaseWorld";
import TokenKey from "../utils/TokenKey";
import { ItemDataParser, ItemDataWriter } from "../utils/ItemData";
import { toHexString } from "../utils/Utils";


export default class ItemPlacementController extends BaseUserController {
    private mouseObserver: Observer<PointerInfo>;
    private keyboardObserver: Observer<KeyboardInfo>;

    private tempObject: Nullable<ItemNode>;
    private tempObjectHelper: Nullable<TempObjectHelper>;
    private tempObjectOffsetY: number;
    private tempObjectRot: Quaternion;
    private tempObjectPos: Vector3;

    private currentItem?: TokenKey | undefined;
    private currentItemQuantity: number = 0;

    constructor(playerController: PlayerController) {
        super(playerController);

        this.tempObject = null;
        this.tempObjectHelper = null;
        this.tempObjectOffsetY = 0;
        this.tempObjectRot = new Quaternion();
        this.tempObjectPos = new Vector3();

        this.mouseObserver = this.playerController.scene.onPointerObservable.add(this.mouseInput, PointerEventTypes.POINTERDOWN | PointerEventTypes.POINTERWHEEL, true)!;
        this.keyboardObserver = this.playerController.scene.onKeyboardObservable.add(this.keyboardInput, KeyboardEventTypes.KEYDOWN, true)!;
    }

    public override dispose(): void {
        this.playerController.scene.onPointerObservable.remove(this.mouseObserver);
        this.playerController.scene.onKeyboardObservable.remove(this.keyboardObserver);

        this.tempObject?.dispose();
        this.tempObject = null;

        this.tempObjectHelper?.dispose();
        this.tempObjectHelper = null;
    }

    public override updateController(hit: Nullable<PickingInfo>): void {
        if(this.tempObject && this.tempObjectHelper) {
            if(hit && hit.pickedPoint) {
                const point = hit.pickedPoint;
                this.tempObjectPos.set(point.x, point.y + this.tempObjectOffsetY, point.z);

                const res = this.toExpectedPrecision();
                this.tempObjectPos.copyFrom(res.pos);
                this.tempObjectRot.copyFrom(res.rot);

                this.tempObjectHelper.posUpdate(this.tempObjectPos);
            }

            // TODO: update only when state changed!!!!
            if(this.playerController.currentPlace &&
                this.playerController.currentPlace.getPermissions.hasPlaceItems() &&
                this.playerController.currentPlace.isInBounds(this.tempObject)) {
                this.tempObject.setEnabled(true);
                this.tempObjectHelper.setValid(true);
            } else {
                this.tempObject.setEnabled(false);
                this.tempObjectHelper.setValid(false);
            }
        }
    }

    private toExpectedPrecision(): {rot: Quaternion, pos: Vector3, scale: number} {
        assert(this.tempObject);
        // serialise and deserialsie, to quantize transform to expected precision.
        const res = ItemDataWriter.write(this.tempObject);
        const [quat_out, pos_out, scale_out] = ItemDataParser.parse(toHexString(res));
        return {rot: quat_out, pos: pos_out, scale: scale_out};
    }

    // Keyboard controls.
    private keyboardInput = (kbInfo: KeyboardInfo) => {
        if(kbInfo.type === KeyboardEventTypes.KEYDOWN) {
            // TEMP: switch item in inventory
            switch(kbInfo.event.code) {
                // Scale
                case "KeyR":
                    if (this.tempObject && this.tempObjectHelper) {
                        const scale = new Vector3(1.1, 1.1, 1.1);
                        this.tempObject.scaling.multiplyInPlace(scale);

                        const new_scale = this.toExpectedPrecision().scale;
                        this.tempObject.scaling.setAll(new_scale);

                        this.tempObjectHelper.scaleUpdate(new_scale);
                    }
                    break;
                
                case "KeyF":
                    if (this.tempObject && this.tempObjectHelper) {
                        const scale = new Vector3(0.9, 0.9, 0.9);
                        this.tempObject.scaling.multiplyInPlace(scale);

                        const new_scale = this.toExpectedPrecision().scale;
                        this.tempObject.scaling.setAll(new_scale);

                        this.tempObjectHelper.scaleUpdate(new_scale);
                    }
                    break;
                
                // Rotate
                case "Digit1":
                    this.tempObject?.rotate(Vector3.Up(), Math.PI / 32);
                    break;
                
                case "Digit2":
                    this.tempObject?.rotate(Vector3.Up(), -Math.PI / 32);
                    break;

                case "Digit3":
                    this.tempObject?.rotate(Vector3.Forward(), Math.PI / 32);
                    break;
                
                case "Digit4":
                    this.tempObject?.rotate(Vector3.Forward(), -Math.PI / 32);
                    break;

                case "Digit5":
                    this.tempObject?.rotate(Vector3.Right(), Math.PI / 32);
                    break;
                
                case "Digit6":
                    this.tempObject?.rotate(Vector3.Right(), -Math.PI / 32);
                    break;
            }
        }
    }

    // mouse interaction when locked
    private mouseInput = async (info: PointerInfo, eventState: EventState) => {
        switch(info.type) {
            case PointerEventTypes.POINTERDOWN:
                if(info.event.button === 0 &&
                    // check permissions
                    this.playerController.currentPlace && this.playerController.currentPlace.getPermissions.hasPlaceItems() &&
                    // check item
                    this.currentItem !== undefined && this.tempObject && this.tempObject.isEnabled()) {

                    // check item balance
                    const currentItemBalance = this.currentItemQuantity - ItemTracker.getTempItemTrack(this.currentItem);
                    if (currentItemBalance <= 0) {
                        // TODO: notification on insufficient balance.
                        this.playerController.appControl.addNotification.dispatch({
                            id: "insufficientBalance" + this.currentItem,
                            title: "Insufficient Balance",
                            body: `You don't have sufficient balance to place more of item ${this.currentItem}.`,
                            type: 'info'
                        });
                    }
                    else {
                        // TODO: move placing items into Place class.
                        const parent = this.playerController.currentPlace.tempItemsNode;
                        assert(parent);

                        const newObject = ItemNode.CreateItemNode(this.playerController.currentPlace, this.currentItem, this.playerController.scene, parent);
                        await newObject.loadItem();

                        if(newObject) {
                            // Make sure item is place relative to place origin.
                            newObject.position = this.tempObject.position.subtract(parent.absolutePosition);
                            newObject.rotationQuaternion = this.tempObjectRot.clone();
                            newObject.scaling = this.tempObject.scaling.clone();

                            eventState.skipNextObservers = true;

                            // If it's a valid token, not an imported model, bring up the place item dialog.
                            if (this.tempObject.isValidItem()) {
                                document.exitPointerLock();
                                this.playerController.appControl.loadForm.dispatch({form_type: OverlayForm.PlaceItem, props: { node: newObject, maxQuantity: currentItemBalance} as PlaceItemFromProps});
                            }
                        }
                    }
                }
                break;

            case PointerEventTypes.POINTERWHEEL:
                const event = info.event as IWheelEvent;
                this.tempObjectOffsetY += event.deltaY * -0.001;

                eventState.skipNextObservers = true;
                break;
        }
    }

    public async setCurrentItem(world: BaseWorld, token_key: TokenKey | undefined, qauntity: number) {
        // remove old object.
        if(this.tempObject) {
            this.tempObject.dispose();
            this.tempObject = null;
        }

        if(this.tempObjectHelper) {
            this.tempObjectHelper.dispose()
            this.tempObjectHelper = null;
        }

        if (token_key === undefined) {
            this.currentItem = undefined;
            this.currentItemQuantity = 0;
            return;
        }

        try {
            this.playerController.gui.setCursor(CursorType.Loading);

            this.tempObject = ItemNode.CreateItemNode(world, token_key, this.playerController.scene, null);
            await this.tempObject.loadItem();

            this.currentItem = token_key;
            this.currentItemQuantity = qauntity;

            // Resetting is important for the TempObjectHelper.
            // as it doesn't seem to be possible to get a hierarchical OOBB.
            this.tempObjectOffsetY = 0;
            this.tempObjectPos.setAll(0);
            this.tempObjectRot.copyFrom(Quaternion.Identity());

            // the temp object.
            this.tempObject.rotationQuaternion = this.tempObjectRot;
            this.tempObject.position = this.tempObjectPos;

            // set pickable false on the whole hierarchy.
            this.tempObject.getChildMeshes(false).forEach((e) => e.isPickable = false );

            // Since assets are scaled to a normalised base scale now, just scale to 2 meters.
            const new_scale = 2; // Scale to 2 meters.
            this.tempObject.scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));

            // positioning helper.
            this.tempObjectHelper = new TempObjectHelper(this.playerController.scene, this.tempObjectRot);
            this.tempObjectHelper.modelUpdate(this.tempObject);

            // reset pointer
            this.playerController.gui.setCursor(CursorType.Pointer);
        }
        catch(e) {
            this.currentItem = undefined;
            this.currentItemQuantity = 0;
            this.playerController.gui.setCursor(CursorType.Pointer);

            this.playerController.appControl.addNotification.dispatch({
                id: "itemLimits" + token_key.id,
                title: "Item failed to load",
                body: `The item you selected (token id: ${token_key.id}) failed to load.\n\nPossibly, it exceeds the Item limits in your settings.`,
                type: 'danger'
            });

            Logging.InfoDev("failed to load item: " + e);
        }
    }

    /**
     * When the user drags and drops a file, it's processed like any other artifact
     * and gets to place it for preview purposes.
     * @param file 
     */
     public async setFile(world: BaseWorld, file: File) {
        // remove old object.
        if(this.tempObject) {
            this.tempObject.dispose();
            this.tempObject = null;
        }

        if(this.tempObjectHelper) {
            this.tempObjectHelper.dispose()
            this.tempObjectHelper = null;
        }

        try {
            this.playerController.gui.setCursor(CursorType.Loading);

            const token_key = TokenKey.fromNumber(-100, "internalitem");

            this.tempObject = ItemNode.CreateItemNode(world, token_key, this.playerController.scene, null);
            await this.tempObject.loadFromFile(file);

            this.currentItem = token_key;
            this.currentItemQuantity = Infinity;

            // Resetting is important for the TempObjectHelper.
            // as it doesn't seem to be possible to get a hierarchical OOBB.
            this.tempObjectOffsetY = 0;
            this.tempObjectPos.setAll(0);
            this.tempObjectRot.copyFrom(Quaternion.Identity());

            // the temp object.
            this.tempObject.rotationQuaternion = this.tempObjectRot;
            this.tempObject.position = this.tempObjectPos;

            // set pickable false on the whole hierarchy.
            this.tempObject.getChildMeshes(false).forEach((e) => e.isPickable = false );

            // Since assets are scaled to a normalised base scale now, just scale to 2 meters.
            const new_scale = 2; // Scale to 2 meters.
            this.tempObject.scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));

            // positioning helper.
            this.tempObjectHelper = new TempObjectHelper(this.playerController.scene, this.tempObjectRot);
            this.tempObjectHelper.modelUpdate(this.tempObject);

            // reset pointer
            this.playerController.gui.setCursor(CursorType.Pointer);
        }
        catch(e: any) {
            this.currentItem = undefined;
            this.currentItemQuantity = 0;
            this.playerController.gui.setCursor(CursorType.Pointer);

            this.playerController.appControl.addNotification.dispatch({
                id: "droppedFileFailed" + file.name,
                title: "File failed to load",
                body: `File "${file.name}" failed to load.\n\nError: ${e.message}`,
                type: 'danger'
            });

            Logging.InfoDev("failed to load file: " + e);
        }
    }
}