import { EventState, IWheelEvent, KeyboardEventTypes,
    KeyboardInfo, Nullable, Observer, PickingInfo,
    PointerEventTypes, PointerInfo, Quaternion, Vector3 } from "@babylonjs/core";
import assert from "assert";
import BigNumber from "bignumber.js";
import { Logging } from "../utils/Logging";
import { OverlayForm, PlaceItemFromProps } from "../world/AppControlFunctions";
import ItemNode from "../world/ItemNode";
import BaseUserController from "./BaseUserController";
import ItemTracker from "./ItemTracker";
import { CursorType } from "./GuiController";
import PlayerController from "./PlayerController";
import TempObjectHelper from "./TempObjectHelper";


export default class ItemPlacementController extends BaseUserController {
    private mouseObserver: Nullable<Observer<PointerInfo>>;
    private keyboardObserver: Nullable<Observer<KeyboardInfo>>;

    private tempObject: Nullable<ItemNode>;
    private tempObjectHelper: Nullable<TempObjectHelper>;
    private tempObjectOffsetY: number;
    private tempObjectRot: Quaternion;
    private tempObjectPos: Vector3;

    private currentItem?: number | undefined;
    private currentItemQuantity: number = 0;

    constructor(playerController: PlayerController) {
        super(playerController);

        this.tempObject = null;
        this.tempObjectHelper = null;
        this.tempObjectOffsetY = 0;
        this.tempObjectRot = new Quaternion();
        this.tempObjectPos = new Vector3();

        this.mouseObserver = null;
        this.keyboardObserver = null;

        // Add the observers with a delay.
        // NOTE: if we don't, they will cause an infinite loop.
        // possibly because of the insertFirst option.
        setTimeout(() => {
            this.mouseObserver = this.playerController.scene.onPointerObservable.add(this.mouseInput, PointerEventTypes.POINTERDOWN | PointerEventTypes.POINTERWHEEL, true);
            this.keyboardObserver = this.playerController.scene.onKeyboardObservable.add(this.keyboardInput, KeyboardEventTypes.KEYDOWN, true);
        }, 0);
    }

    public override dispose() {
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
                        this.tempObjectHelper.scaleUpdate(scale);
                    }
                    break;
                
                case "KeyF":
                    if (this.tempObject && this.tempObjectHelper) {
                        const scale = new Vector3(0.9, 0.9, 0.9);
                        this.tempObject.scaling.multiplyInPlace(scale);
                        this.tempObjectHelper.scaleUpdate(scale);
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
                        this.playerController.appControlFunctions.addNotification({
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

                        const newObject = ItemNode.CreateItemNode(this.playerController.currentPlace.placeId, new BigNumber(this.currentItem), this.playerController.scene, parent);
                        await newObject.loadItem();

                        if(newObject) {
                            // Make sure item is place relative to place origin.
                            newObject.position = this.tempObject.position.subtract(parent.absolutePosition);
                            newObject.rotationQuaternion = this.tempObjectRot.clone();
                            newObject.scaling = this.tempObject.scaling.clone();

                            eventState.skipNextObservers = true;

                            document.exitPointerLock();
                            this.playerController.appControlFunctions.loadForm(OverlayForm.PlaceItem, { node: newObject, maxQuantity: currentItemBalance} as PlaceItemFromProps);
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

    public async setCurrentItem(token_id: number | undefined, qauntity: number) {
        // remove old object.
        if(this.tempObject) {
            this.tempObject.dispose();
            this.tempObject = null;
        }

        if(this.tempObjectHelper) {
            this.tempObjectHelper.dispose()
            this.tempObjectHelper = null;
        }

        if (token_id === undefined) {
            this.currentItem = undefined;
            this.currentItemQuantity = 0;
            return;
        }

        try {
            this.playerController.gui.setCursor(CursorType.Loading);

            this.tempObject = ItemNode.CreateItemNode(-1, new BigNumber(token_id), this.playerController.scene, null);
            await this.tempObject.loadItem();

            this.currentItem = token_id;
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

            this.playerController.appControlFunctions.addNotification({
                id: "itemLimits" + token_id,
                title: "Item failed to load",
                body: `The item you selected (token id: ${token_id}) failed to load.\n\nPossibly, it exceeds the Item limits in your settings.`,
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
     public async setFile(file: File) {
        Logging.Info("PlayerController.handleDroppedFile");

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

            this.tempObject = ItemNode.CreateItemNode(-1, new BigNumber(-1), this.playerController.scene, null);
            await this.tempObject.loadFromFile(file);

            this.currentItem = -1;
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

            this.playerController.appControlFunctions.addNotification({
                id: "droppedFileFailed" + file.name,
                title: "File failed to load",
                body: `File "${file.name}" failed to load.\n\nError: ${e.message}`,
                type: 'danger'
            });

            Logging.InfoDev("failed to load file: " + e);
        }
    }
}