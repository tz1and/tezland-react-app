import { ActionManager, Camera, IWheelEvent, KeyboardEventTypes, Mesh, MeshBuilder, Nullable, PointerEventTypes, Quaternion, Scene, ShadowGenerator, Vector3 } from "@babylonjs/core";
import assert from "assert";
//import { SimpleMaterial } from "@babylonjs/materials/simple";
import * as ipfs from "../ipfs/ipfs";
import { AppControlFunctions } from "../world/AppControlFunctions";
import Place from "../world/Place";
import { World } from "../world/World";
import PickingGuiController from "./PickingGuiController";


export default class PlayerController {
    private camera: Camera;
    private scene: Scene;
    private shadowGenerator: ShadowGenerator;

    private tempObject: Nullable<Mesh>;
    private tempObjectOffsetY: number;
    private tempObjectRot: Quaternion;
    //private state: ControllerState;

    private pickingGui: PickingGuiController;

    readonly playerTrigger: Mesh;

    private beforeRenderer: () => void;
    /*private handleKeyUp: (e: KeyboardEvent) => void;
    private handleKeyDown: (e: KeyboardEvent) => void;*/

    private isPointerLocked: boolean = false;
    private currentPlace: Nullable<Place>;
    private currentItem?: number;

    constructor(camera: Camera, world: World, shadowGenerator: ShadowGenerator, canvas: HTMLCanvasElement, appControlfunctions: AppControlFunctions) {
        this.camera = camera;
        this.scene = world.scene;
        this.shadowGenerator = shadowGenerator;
        this.currentPlace = null;
        this.tempObject = null;
        this.tempObjectOffsetY = 0;
        this.tempObjectRot = new Quaternion();
        this.pickingGui = new PickingGuiController(world);

        // TEMP-ish: get coordinates from url.
        const urlParams = new URLSearchParams(window.location.search);

        if(urlParams.has('coordx') && urlParams.has('coordz')) {
            this.camera.position.x = parseFloat(urlParams.get('coordx')!);
            this.camera.position.z = parseFloat(urlParams.get('coordz')!);
        }

        this.playerTrigger = MeshBuilder.CreateCapsule("player", {height: 1.8, radius: 0.5, updatable: false}, this.scene);
        this.playerTrigger.isPickable = false;
        this.playerTrigger.isVisible = false;
        this.playerTrigger.actionManager = new ActionManager(this.scene);

        this.beforeRenderer = () => { this.updateController() };
        this.scene.registerBeforeRender(this.beforeRenderer);

        // Pointer lock stuff - not needed since we have the overlay now.
        /*this.scene.onPointerObservable.add((event, eventState) => {
            // probably not needed since we have a mask.
            if (event.type === PointerEventTypes.POINTERDOWN) {
                //true/false check if we're locked, faster than checking pointerlock on each single click.
                if (!this.isPointerLocked) {
                    if (canvas.requestPointerLock) {
                        canvas.requestPointerLock();
                    }

                    eventState.skipNextObservers = true;
                }
            }
        }, PointerEventTypes.POINTERDOWN, true); // insert first*/

        // Event listener when the pointerlock is updated (or removed by pressing ESC for example).
        var pointerlockchange = () => {
            /* document.mozPointerLockElement || document.webkitPointerLockElement || document.msPointerLockElement ||  */
            var controlEnabled = document.pointerLockElement || null;
            
            // If the user is already locked
            if (!controlEnabled) {
                this.camera.detachControl(canvas);
                this.isPointerLocked = false;
                appControlfunctions.setOverlayDispaly(true);
            } else {
                this.camera.attachControl(canvas);
                this.isPointerLocked = true;
            }
        };

        // Attach events to the document
        document.addEventListener("pointerlockchange", pointerlockchange, false);

        // mouse interaction when locked
        this.scene.onPointerObservable.add(async (info, eventState) => {
            if (info.type === PointerEventTypes.POINTERDOWN) {
                if(this.currentPlace && this.currentPlace.isOwned && this.currentItem && this.tempObject && this.tempObject.isEnabled()) {

                    // TODO: move placing items into Place class.
                    const parent = this.currentPlace.itemsNode;
                    assert(parent);

                    const newObject = await ipfs.download_item(this.currentItem, this.scene, parent) as Mesh;
                    // Make sure item is place relative to place origin.
                    newObject.position = this.tempObject.position.subtract(parent.position);
                    newObject.rotationQuaternion = this.tempObjectRot.clone();
                    newObject.scaling = this.tempObject.scaling.clone();
                    newObject.metadata = { itemTokenId: this.currentItem }

                    shadowGenerator.addShadowCaster(newObject);

                    eventState.skipNextObservers = true;

                    document.exitPointerLock();
                    appControlfunctions.placeItem(newObject);
                }
            }
            else if (info.type === PointerEventTypes.POINTERWHEEL) {
                var event = info.event as IWheelEvent;
                this.tempObjectOffsetY += event.deltaY * -0.001;

                eventState.skipNextObservers = true;
            }
        }, undefined, true);

        // Keyboard controls. Save, remove, place, mint, whatever.
        this.scene.onKeyboardObservable.add((kbInfo, eventState) => {
            if(kbInfo.type === KeyboardEventTypes.KEYDOWN){
                // TEMP: switch item in inventory
                switch(kbInfo.event.code) {
                    // Scale
                    case "KeyR":
                        this.tempObject?.scaling.multiplyInPlace(new Vector3(1.1, 1.1, 1.1));
                        break;
                    
                    case "KeyF":
                        this.tempObject?.scaling.multiplyInPlace(new Vector3(0.9, 0.9, 0.9));
                        break;
                    
                    // Rotate
                    case "KeyE":
                        this.tempObject?.rotateAround(new Vector3(), new Vector3(0,1,0), Math.PI / 20);
                        break;
                    
                    case "KeyQ":
                        this.tempObject?.rotateAround(new Vector3(), new Vector3(0,1,0), -Math.PI / 20);
                        break;
                    
                    // Save place
                    case "KeyU":
                        if(this.currentPlace) {
                            // exit pointer lock and send operation.
                            document.exitPointerLock();
                            this.currentPlace.save();
                        }
                        break;
                    
                    case 'KeyM': // Opens the mint form
                        document.exitPointerLock();
                        appControlfunctions.loadForm('mint');
                        break;

                    case 'KeyI': // Opens the inventory
                        document.exitPointerLock();
                        appControlfunctions.loadForm('inventory');
                        break;

                    case 'KeyC': // Clear item selection
                        this.setCurrentItem();
                        break;
                }
            }

            /*switch (kbInfo.type) {
                case KeyboardEventTypes.KEYDOWN:
                    console.log("KEY DOWN: ", kbInfo.event.code);
                    break;
                case KeyboardEventTypes.KEYUP:
                    console.log("KEY UP: ", kbInfo.event.code);
                    break;
            }*/
        }, KeyboardEventTypes.KEYDOWN);
    }

    public setCurrentPlace(place: Place) {
        this.currentPlace = place;
    }

    public async setCurrentItem(item_id?: number) {
        // remove old object.
        if(this.tempObject) {
            this.tempObject.dispose();
            this.tempObject = null;
        }

        this.currentItem = item_id;

        if (!this.currentItem) return;

        this.tempObject = await ipfs.download_item(this.currentItem, this.scene, null) as Mesh;
        this.tempObject.rotationQuaternion = this.tempObjectRot;

        // set pickable false on the whole hierarchy.
        this.tempObject.getChildMeshes(false).forEach((e) => e.isPickable = false );

        /*const transparent_mat = new SimpleMaterial("tranp", this.scene);
        //transparent_mat.alpha = 0.2;
        //transparent_mat.disableLighting = true;
        //transparent_mat.backFaceCulling = false;
        transparent_mat.diffuseColor.set(0.8, 0.2, 0.2);

        this.tempObject = Mesh.CreateBox("tempObject", 1, this.scene);
        this.tempObject.material = transparent_mat;
        this.tempObject.isPickable = false;
        //this.tempObject.rotationQuaternion = this.tempObjectRot;*/
        this.shadowGenerator.addShadowCaster(this.tempObject as Mesh);

        // make sure picking gui goes away.
        this.pickingGui.updatePickingGui(null, 0);
    }

    private updateController() {
        //const delta_time: number = this.scene.getEngine().getDeltaTime() / 1000;

        // update player trigger mesh position.
        this.playerTrigger.position.set(this.camera.position.x, this.camera.position.y - 0.9, this.camera.position.z);

        // following from here, stuff is relating to placing items.
        // we can early out if there is no current place.
        // TODO: pretty sure this doesn't do anything.
        if(!this.currentPlace) return;

        const hit = this.scene.pickWithRay(this.camera.getForwardRay());

        if(this.tempObject) {
            if(hit && hit.pickedPoint) {
                const point = hit.pickedPoint;
                this.tempObject.position.set(point.x, point.y + this.tempObjectOffsetY, point.z);
            }

            if(this.currentPlace.isOwned && this.currentPlace.isInBounds(this.tempObject)) {
                this.tempObject.setEnabled(true);
                //this.tempObject.material!.alpha = 1;
            } else {
                this.tempObject.setEnabled(false);
                //this.tempObject.material!.alpha = 0.2;
            }
        } else if (hit) {
            this.pickingGui.updatePickingGui(hit.pickedMesh, hit.distance);
        }
    }
}