import { ActionManager, FreeCamera, IWheelEvent, KeyboardEventTypes, Mesh, MeshBuilder, Nullable, PointerEventTypes, Quaternion, Scene, ShadowGenerator, UniversalCamera, Vector3 } from "@babylonjs/core";
import assert from "assert";
import BigNumber from "bignumber.js";
//import { SimpleMaterial } from "@babylonjs/materials/simple";
import * as ipfs from "../ipfs/ipfs";
import { Logging } from "../utils/Logging";
import { AppControlFunctions } from "../world/AppControlFunctions";
import Place, { InstanceMetadata } from "../world/Place";
import { World } from "../world/World";
import PickingGuiController from "./PickingGuiController";


const PlayerWalkSpeed = 0.05; // should come out to about 1.6m/s
const PlayerJogSpeed = PlayerWalkSpeed * 1.6; // comes out to about 2.5m/s

export default class PlayerController {
    private camera: FreeCamera;
    private scene: Scene;
    private shadowGenerator: ShadowGenerator;

    private tempObject: Nullable<Mesh>;
    private tempObjectOffsetY: number;
    private tempObjectRot: Quaternion;
    //private state: ControllerState;

    private pickingGui: PickingGuiController;

    readonly playerTrigger: Mesh;

    /*private handleKeyUp: (e: KeyboardEvent) => void;
    private handleKeyDown: (e: KeyboardEvent) => void;*/

    private isPointerLocked: boolean = false; // TODO: still needed for something?
    private currentPlace: Nullable<Place>;
    private currentItem?: number;

    private onPointerlockChange: () => void;
    private onPointerlockError: () => void;

    constructor(world: World, shadowGenerator: ShadowGenerator, canvas: HTMLCanvasElement, appControlfunctions: AppControlFunctions) {
        this.scene = world.scene;
        this.shadowGenerator = shadowGenerator;
        this.currentPlace = null;
        this.tempObject = null;
        this.tempObjectOffsetY = 0;
        this.tempObjectRot = new Quaternion();
        this.pickingGui = new PickingGuiController(world);
        this.camera = this.initCamera();

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

        this.scene.registerAfterRender(this.updateController.bind(this));

        // Event listener when the pointerlock is updated (or removed by pressing ESC for example).
        this.onPointerlockChange = () => {
            var controlEnabled = document.pointerLockElement || null;
            
            // If the user is already locked
            if (!controlEnabled) {
                // blur canvas to stop keyboard events.
                canvas.blur();
                this.camera.detachControl(canvas);
                this.isPointerLocked = false;
                appControlfunctions.setOverlayDispaly(true);
            } else {
                // focus on canvas for keyboard input to work.
                canvas.focus();
                this.camera.attachControl(canvas);
                this.isPointerLocked = true;
            }
        };

        // Catch pointerlock errors to not get stuck
        this.onPointerlockError = () => {
            Logging.Error("Pointerlock request failed.");
            appControlfunctions.loadForm('instructions');
        };

        // add pointerlock event listeners
        document.addEventListener("pointerlockchange", this.onPointerlockChange, false);
        document.addEventListener("pointerlockerror", this.onPointerlockError, false);

        // mouse interaction when locked
        this.scene.onPointerObservable.add(async (info, eventState) => {
            switch(info.type) {
                case PointerEventTypes.POINTERDOWN:
                    if(info.event.button === 0 && this.currentPlace && this.currentPlace.isOwned &&
                        this.currentItem !== undefined && this.tempObject && this.tempObject.isEnabled()) {

                        // TODO: move placing items into Place class.
                        const parent = this.currentPlace.tempItemsNode;
                        assert(parent);

                        const newObject = await ipfs.download_item(new BigNumber(this.currentItem), this.scene, parent) as Mesh;
                        if(newObject) {
                            // Make sure item is place relative to place origin.
                            newObject.position = this.tempObject.position.subtract(parent.position);
                            newObject.rotationQuaternion = this.tempObjectRot.clone();
                            newObject.scaling = this.tempObject.scaling.clone();
                            newObject.metadata = {
                                itemTokenId: new BigNumber(this.currentItem),
                                placeId: this.currentPlace.placeId
                            } as InstanceMetadata;

                            shadowGenerator.addShadowCaster(newObject);

                            eventState.skipNextObservers = true;

                            document.exitPointerLock();
                            appControlfunctions.placeItem(newObject);
                        }
                    }
                    break;

                case PointerEventTypes.POINTERWHEEL:
                    const event = info.event as IWheelEvent;
                    this.tempObjectOffsetY += event.deltaY * -0.001;

                    eventState.skipNextObservers = true;
                    break;
            }
        }, PointerEventTypes.POINTERDOWN | PointerEventTypes.POINTERWHEEL, true);

        // Keyboard controls. Save, remove, place, mint, whatever.
        this.scene.onKeyboardObservable.add((kbInfo) => {
            if(kbInfo.type === KeyboardEventTypes.KEYUP) {
                switch(kbInfo.event.code) {
                    // Scale
                    case "ShiftLeft":
                        this.camera.speed = PlayerJogSpeed;
                        break;
                }
            }
            else if(kbInfo.type === KeyboardEventTypes.KEYDOWN) {
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
                        this.tempObject?.rotateAround(this.tempObject.position, new Vector3(0,1,0), Math.PI / 32);
                        break;
                    
                    case "KeyQ":
                        this.tempObject?.rotateAround(this.tempObject.position, new Vector3(0,1,0), -Math.PI / 32);
                        break;
                    
                    // Save place
                    case "KeyU":
                        if(this.currentPlace) {
                            if(this.currentPlace.save())
                                document.exitPointerLock();
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

                    case 'ShiftLeft': // Enable jog
                        this.camera.speed = PlayerWalkSpeed;
                        break;

                    case 'Delete': // Mark item for deletion
                        const current_item = this.pickingGui.getCurrentItem();
                        if(current_item) {
                            const metadata = current_item.metadata as InstanceMetadata;
                            const place = world.places.get(metadata.placeId);
                            if(place && place.isOwned) {
                                // If the item is unsaved, remove it directly.
                                if(metadata.id === undefined) {
                                    current_item.dispose();
                                }
                                // Otherwise mark it for removal.
                                else {
                                    metadata.markForRemoval = true;
                                    current_item.setEnabled(false);
                                }
                            }
                        }
                        break;
                }
            }
        }, KeyboardEventTypes.KEYDOWN | KeyboardEventTypes.KEYUP);
    }

    private initCamera(): FreeCamera {
        // This creates and positions a free camera (non-mesh)
        var camera = new UniversalCamera("camera1", new Vector3(0, 2, 0), this.scene);

        // Camera props
        camera.fovMode = UniversalCamera.FOVMODE_HORIZONTAL_FIXED;
        camera.fov = 1.65806; // ~95 deg.
        camera.minZ = 0.1;

        // Collision stuff
        camera.checkCollisions = true;
        camera.applyGravity = true;
        camera.ellipsoid = new Vector3(0.5, 0.9, 0.5);

        // Set movement keys
        camera.keysLeft = [65 /*w*/, 37 /*left arrow*/];
        camera.keysRight = [68 /*d*/, 39 /*right arrow*/];
        camera.keysUp = [87 /*w*/, 38 /*up arrow*/];
        camera.keysDown = [83 /*s*/, 40 /*down arrow*/];
        //camera.keysUpward = [32 /*space*/]; // that's not actually jumping.
        camera.speed = PlayerJogSpeed;
        //this.camera.ellipsoidOffset = new Vector3(0, 0, 0);
        //camera.inertia = 0.5;
        //camera.angularSensibility = 2;
        //this.camera.checkCollisions = false;

        // This targets the camera to scene origin
        //camera.setTarget(Vector3.Zero());

        // This attaches the camera to the canvas
        //camera.attachControl(canvas, true);

        return camera;
    }

    public dispose() {
        document.removeEventListener("pointerlockchange", this.onPointerlockChange, false);
        document.removeEventListener("pointerlockerror", this.onPointerlockError, false);

        this.pickingGui.dispose();

        this.tempObject = null;
        this.currentPlace = null;
        // TODO: shadowgen?
    }

    /**
     * Important: returns a ref to the player position!
     * @returns Vector3
     */
    public getPosition(): Vector3 {
        return this.camera.position;
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
        if (this.currentItem === undefined) return;

        try {
            this.tempObject = await ipfs.download_item(new BigNumber(this.currentItem), this.scene, null) as Mesh;
            if(this.tempObject) {
                this.tempObject.rotationQuaternion = this.tempObjectRot;

                // set pickable false on the whole hierarchy.
                this.tempObject.getChildMeshes(false).forEach((e) => e.isPickable = false );

                // Scale object based on extent.
                const {min, max} = this.tempObject.getHierarchyBoundingVectors(true);
                const extent = max.subtract(min);
                const extent_max = Math.max(Math.max(extent.x, extent.y), extent.z);
                const new_scale = 2 / extent_max; // Scale to 2 meters.
                this.tempObject.scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));
                // throws an error for some reason.
                //this.tempObject.getChildMeshes(false).forEach((e) => e.visibility = 0.5 );

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
                await this.pickingGui.updatePickingGui(null, 0);
            }
            else this.currentItem = undefined;
        }
        catch(e) {
            this.currentItem = undefined;

            Logging.InfoDev("failed to load item: " + e);
        }
    }

    // Some code to measure travel speed, because babylonjs is so
    // excitingly vague.
    /*private lastDistanceUpdate: number = 0;
    private lastPos: Vector3 = new Vector3();

    private measureTravelSpeed() {
        const now = performance.now();
        const elapsed = now - this.lastDistanceUpdate;
        if(elapsed > 1000) {
            this.lastDistanceUpdate = now;
            const travelled = this.lastPos.subtract(this.getPosition()).length();
            this.lastPos = this.getPosition().clone();
            console.log(`Travelled ${travelled}m in ${elapsed}ms`);
        }
    }*/

    private updateController() {
        //const delta_time: number = this.scene.getEngine().getDeltaTime() / 1000;

        // update player trigger mesh position.
        this.playerTrigger.position.set(this.camera.position.x, this.camera.position.y - 0.9, this.camera.position.z);

        // cast a ray for picking guy and item placing
        const hit = this.scene.pickWithRay(this.camera.getForwardRay());

        if(this.tempObject) {
            if(hit && hit.pickedPoint) {
                const point = hit.pickedPoint;
                this.tempObject.position.set(point.x, point.y + this.tempObjectOffsetY, point.z);
            }

            if(this.currentPlace && this.currentPlace.isOwned && this.currentPlace.isInBounds(this.tempObject)) {
                this.tempObject.setEnabled(true);
                //this.tempObject.material!.alpha = 1;
            } else {
                this.tempObject.setEnabled(false);
                //this.tempObject.material!.alpha = 0.2;
            }
        } else if (hit) {
            // TODO: await this somehow?
            this.pickingGui.updatePickingGui(hit.pickedMesh, hit.distance);
        }
    }
}