import { ActionManager, Axis, FreeCamera, IWheelEvent, KeyboardEventTypes,
    Mesh, Nullable, PointerEventTypes, Quaternion, Ray, Scene,
    ShadowGenerator, Vector3 } from "@babylonjs/core";
import assert from "assert";
import BigNumber from "bignumber.js";
import * as ipfs from "../ipfs/ipfs";
import AppSettings from "../storage/AppSettings";
import Contracts from "../tz/Contracts";
import { Logging } from "../utils/Logging";
import { isEpsilonEqual } from "../utils/Utils";
import { AppControlFunctions } from "../world/AppControlFunctions";
import Place, { InstanceMetadata } from "../world/Place";
import { World } from "../world/World";
import PickingGuiController from "./PickingGuiController";
import { PlayerKeyboardInput } from "./PlayerInput";
import TempObjectHelper from "./TempObjectHelper";


const PlayerWalkSpeed = 0.05; // should come out to about 1.6m/s
const PlayerJogSpeed = PlayerWalkSpeed * 1.6; // comes out to about 2.5m/s

export default class PlayerController {
    private camera: FreeCamera;
    private scene: Scene;
    private _shadowGenerator: Nullable<ShadowGenerator>;
    public set shadowGenerator(sg: Nullable<ShadowGenerator>) { this._shadowGenerator = sg; }
    public get shadowGenerator(): Nullable<ShadowGenerator> { return this._shadowGenerator; }

    private tempObject: Nullable<Mesh>;
    private tempObjectHelper: Nullable<TempObjectHelper>;
    private tempObjectOffsetY: number;
    private tempObjectRot: Quaternion;
    private tempObjectPos: Vector3;
    //private state: ControllerState;

    private pickingGui: PickingGuiController;

    readonly playerTrigger: Mesh;

    private input: PlayerKeyboardInput;
    private velocity: Vector3 = new Vector3();
    private gravity: Vector3 = new Vector3();
    private player_speed: number = PlayerJogSpeed;

    private static readonly GRAVITY = 2.8;
    private static readonly BODY_HEIGHT = 1.5;
    private static readonly LEGS_HEIGHT = 0.3;

    private _flyMode: boolean;
    public get flyMode(): boolean { return this._flyMode; }

    /*private handleKeyUp: (e: KeyboardEvent) => void;
    private handleKeyDown: (e: KeyboardEvent) => void;*/

    //private isPointerLocked: boolean = false; // TODO: still needed for something?
    private currentPlace: Nullable<Place>;
    private currentItem?: number | undefined;

    private onPointerlockChange: () => void;
    private onPointerlockError: () => void;

    constructor(world: World, canvas: HTMLCanvasElement, appControlfunctions: AppControlFunctions) {
        this.scene = world.scene;
        this._shadowGenerator = null;
        this.currentPlace = null;
        this.tempObject = null;
        this.tempObjectHelper = null;
        this.tempObjectOffsetY = 0;
        this.tempObjectRot = new Quaternion();
        this.tempObjectPos = new Vector3();
        this.pickingGui = new PickingGuiController(world);
        this._flyMode = false;
        this.camera = this.initCamera();

        this.input = new PlayerKeyboardInput();
        this.input.keysLeft = [65 /*w*/, 37 /*left arrow*/];
        this.input.keysRight = [68 /*d*/, 39 /*right arrow*/];
        this.input.keysUp = [87 /*w*/, 38 /*up arrow*/];
        this.input.keysDown = [83 /*s*/, 40 /*down arrow*/];

        // TEMP-ish: get coordinates from url.
        const urlParams = new URLSearchParams(window.location.search);

        if(urlParams.has('coordx') && urlParams.has('coordz')) {
            this.camera.position.x = parseFloat(urlParams.get('coordx')!);
            this.camera.position.z = parseFloat(urlParams.get('coordz')!);
        }

        // Mesh builder :  {height: PlayerController.BODY_HEIGHT, radius: 0.5, updatable: false}
        this.playerTrigger = new Mesh("player", this.scene);
        this.playerTrigger.ellipsoid = new Vector3(0.5, PlayerController.BODY_HEIGHT * 0.5, 0.5);
        this.playerTrigger.position.y = 2;
        this.playerTrigger.isPickable = false;
        this.playerTrigger.isVisible = false;
        this.playerTrigger.actionManager = new ActionManager(this.scene);
        this.camera.parent = this.playerTrigger;

        this.scene.registerAfterRender(this.updateController.bind(this));

        // Event listener when the pointerlock is updated (or removed by pressing ESC for example).
        this.onPointerlockChange = () => {
            var controlEnabled = document.pointerLockElement || null;
            
            // If the user is already locked
            if (!controlEnabled) {
                // blur canvas to stop keyboard events.
                canvas.blur();
                this.camera.detachControl();
                this.input.detachControl();
                //this.isPointerLocked = false;
                appControlfunctions.setOverlayDispaly(true);
            } else {
                // focus on canvas for keyboard input to work.
                canvas.focus();
                this.camera.attachControl();
                this.input.attachControl(this.scene);
                //this.isPointerLocked = true;
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

        this.setCurrentPlace = (place: Place) => {
            this.currentPlace = place;
            appControlfunctions.updatePlaceInfo(place.placeId, place.currentOwner, place.getPermissions);
        }

        // mouse interaction when locked
        this.scene.onPointerObservable.add(async (info, eventState) => {
            switch(info.type) {
                case PointerEventTypes.POINTERDOWN:
                    if(info.event.button === 0 && this.currentPlace && this.currentPlace.getPermissions.hasPlaceItems() &&
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

                            this.shadowGenerator?.addShadowCaster(newObject);

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
                        this.player_speed = PlayerJogSpeed;
                        break;
                }
            }
            else if(kbInfo.type === KeyboardEventTypes.KEYDOWN) {
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
                    
                    // Save place
                    case "KeyU":
                        if(this.currentPlace) {
                            if(this.currentPlace.save())
                                document.exitPointerLock();
                        }
                        break;
                    
                    // Opens the mint form
                    case 'KeyM':
                        document.exitPointerLock();
                        appControlfunctions.loadForm('mint');
                        break;

                    // Opens the place properties form
                    case 'KeyP':
                        if(this.currentPlace && this.currentPlace.getPermissions.hasProps()) {
                            Contracts.getItemsForPlaceView(world.walletProvider, this.currentPlace.placeId, false).then((res) => {
                                assert(this.currentPlace);
                                document.exitPointerLock();
                                // NOTE: we just assume, placeInfo in Explore is up to date.
                                appControlfunctions.editPlaceProperties('#' + res.place_props);
                            })
                        }
                        break;

                    // Opens the inventory
                    case 'KeyI':
                        document.exitPointerLock();
                        appControlfunctions.loadForm('inventory');
                        break;

                    // Clear item selection
                    case 'KeyC':
                        this.setCurrentItem();
                        break;

                    // Toggle fly mode
                    case 'KeyG':
                        this.toggleFlyMode();
                        this.playerTrigger.position.y = 1000;
                        break;

                    /*case 'KeyB':
                        chrome.bookmarks.create({
                            title: "bookmarks.create() on MDN",
                            url: "https://developer.mozilla.org/Add-ons/WebExtensions/API/bookmarks/create"
                        }, () => {
                            document.exitPointerLock();
                        });
                        break;*/

                    case 'ShiftLeft': // Enable jog
                        this.player_speed = PlayerWalkSpeed;
                        break;

                    case 'Delete': // Mark item for deletion
                        const current_item = this.pickingGui.getCurrentItem();
                        if(current_item) {
                            const metadata = current_item.metadata as InstanceMetadata;
                            const place = world.places.get(metadata.placeId);
                            if(place && (metadata.issuer === world.walletProvider.walletPHK() || place.getPermissions.hasModifyAll())) {
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
        var camera = new FreeCamera("playerCamera", new Vector3(0, PlayerController.BODY_HEIGHT * 0.5, 0), this.scene);

        // Camera props
        camera.fovMode = FreeCamera.FOVMODE_HORIZONTAL_FIXED;
        camera.fov = 1.65806; // ~95 deg.
        camera.minZ = 0.1;
        camera.maxZ = 2000;

        // Collision stuff
        //camera.checkCollisions = true;
        //camera.applyGravity = true;
        //camera.ellipsoid = new Vector3(0.5, PlayerController.BODY_HEIGHT * 0.5, 0.5);

        // Sensibility
        camera.angularSensibility = camera.angularSensibility * 10 / AppSettings.mouseSensitivity.value;
        // TODO: inertia also affects movement...
        camera.inertia = 0;

        // Set movement keys
        camera.inputs.clear();
        camera.inputs.addMouse();
        ////camera.keysUpward = [32 /*space*/]; // that's not actually jumping.
        ////this.camera.ellipsoidOffset = new Vector3(0, 0, 0);
        ////camera.inertia = 0.5;
        ////camera.angularSensibility = 2;

        return camera;
    }

    public dispose() {
        document.removeEventListener("pointerlockchange", this.onPointerlockChange, false);
        document.removeEventListener("pointerlockerror", this.onPointerlockError, false);

        this.pickingGui.dispose();

        this.tempObject = null;
        this.currentPlace = null;
        this.shadowGenerator = null;
    }

    private toggleFlyMode(): void {
        this._flyMode = !this._flyMode;
        this.camera.applyGravity = !this._flyMode;
    }

    /**
     * Important: returns a ref to the player position!
     * @returns Vector3
     */
    public getPosition(): Vector3 {
        return this.camera.globalPosition;
    }

    /**
     * Important: returns a ref to the player quaternion!
     * @returns Vector3
     */
    public getRotation(): Vector3 {
        return this.camera.rotation;
    }

    public setCurrentPlace: (place: Place) => void;

    public getCurrentPlace() { return this.currentPlace; }

    public async setCurrentItem(token_id?: number) {
        // remove old object.
        if(this.tempObject) {
            this.tempObject.dispose();
            this.tempObject = null;
        }

        if(this.tempObjectHelper) {
            this.tempObjectHelper.dispose()
            this.tempObjectHelper = null;
        }

        this.currentItem = token_id;
        if (this.currentItem === undefined) return;

        // Resetting is important for the TempObjectHelper.
        // as it doesn't seem to be possible to get a hierarchical OOBB.
        this.tempObjectPos = new Vector3();
        this.tempObjectRot = new Quaternion();

        try {
            this.tempObject = await ipfs.download_item(new BigNumber(this.currentItem), this.scene, null) as Mesh;
            if(this.tempObject) {
                // the temp object.
                this.tempObject.rotationQuaternion = this.tempObjectRot;
                this.tempObject.position = this.tempObjectPos;

                // set pickable false on the whole hierarchy.
                this.tempObject.getChildMeshes(false).forEach((e) => e.isPickable = false );

                // Since assets are scaled to a normalised base scale now, just scale to 2 meters.
                const new_scale = 2; // Scale to 2 meters.
                this.tempObject.scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));

                // positioning helper.
                this.tempObjectHelper = new TempObjectHelper(this.scene, this.tempObjectRot);
                this.tempObjectHelper.modelUpdate(this.tempObject);
                
                // add shadows caster.
                this.shadowGenerator?.addShadowCaster(this.tempObject as Mesh);

                // make sure picking gui goes away.
                await this.pickingGui.updatePickingGui(null, 0);
            }
            else {
                this.currentItem = undefined;
                // TODO: notification when model failed to load for some reason!
            }
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
            Logging.Log(`Travelled ${travelled}m in ${elapsed}ms`);
        }
    }*/

    //Send raycast to the floor to detect if there are any hits with meshes below the character
    private floorRaycast(offsetx: number, offsetz: number, raycastlen?: number): number {
        //position the raycast from bottom center of mesh
        let raycastFloorPos = new Vector3(this.playerTrigger.position.x + offsetx, this.playerTrigger.position.y - (PlayerController.BODY_HEIGHT * 0.5), this.playerTrigger.position.z + offsetz);
        let ray = new Ray(raycastFloorPos, Vector3.Down(), raycastlen);

        let pick = this.scene.pickWithRay(ray);

        if (pick && pick.hit) {
            return pick.distance;
        } else {
            return Infinity;
        }
    }

    private static readonly EPSILON = 0.00000001;

    private groundPlayer(): number {
        let dist_to_ground = this.floorRaycast(0, 0);
        // If less than leg height, adjust position.
        if(dist_to_ground + PlayerController.EPSILON < PlayerController.LEGS_HEIGHT) {
            this.playerTrigger.position.y += PlayerController.LEGS_HEIGHT - dist_to_ground;
            dist_to_ground = PlayerController.LEGS_HEIGHT;
        }
        return dist_to_ground;
    }

    private updateFromControls(delta_time: number): void {
        // Get inputs
        this.input.checkInputs();
        const moveFwd = this.input.forward; //fwd, z
        const moveRight = this.input.right; //right, x

        // Figure out directions.
        const cam_dir = this.camera.getDirection(Axis.Z);
        const right = Vector3.Cross(Vector3.Up(), cam_dir);
        const fwd = Vector3.Cross(right, Vector3.Up());

        // TODO: switch between jog and walk.

        // Player velocity.
        const accel = delta_time * 3
        const new_vel = fwd.scale(moveFwd).add(right.scale(moveRight)).normalize().scale(this.player_speed * accel);
        this.velocity.scaleInPlace(1 - accel).addInPlace(new_vel);

        // Not needed if accel and decel are eq.
        /*if(this.velocity.length() > PlayerJogSpeed) {
            console.log("claming vel");
            this.velocity.normalize().scaleInPlace(PlayerJogSpeed);
        }*/

        // Get the distance to ground
        let dist_to_ground = this.groundPlayer();
        const grounded = isEpsilonEqual(dist_to_ground, PlayerController.LEGS_HEIGHT, PlayerController.EPSILON);

        // TODO: obstacles should affect velocity!
        // Work that out based on distance travlled before and after moveWithCollisions.
        // Actually, that doesn't work, velocity will invert when teleporting happens with moveWithCollisions.
        // This is dumb.
        //const pos_before = this.playerTrigger.position.clone();

        if(!grounded) {
            // increase fall velocity.
            this.gravity.addInPlace(Vector3.Down().scale(delta_time * PlayerController.GRAVITY));
            this.velocity.y = this.gravity.y;

            this.playerTrigger.moveWithCollisions(this.velocity);

            // ground player again after applying gravity.
            this.groundPlayer();
        } else {
            // reset fall velocity.
            this.gravity = new Vector3();
            this.velocity.y = this.gravity.y;

            this.playerTrigger.moveWithCollisions(this.velocity);
        }

        // This kinda somewhat works but isn't perfect.
        /*const vel_actual = this.playerTrigger.position.subtract(pos_before);
        if (Vector3.Dot(vel_actual, this.velocity) < 0) {
            this.playerTrigger.position = pos_before;
            this.velocity.set(0, 0, 0);
        }
        else this.velocity.set(vel_actual.x, 0, vel_actual.z);*/
    }

    private updateController() {
        const delta_time: number = this.scene.getEngine().getDeltaTime() / 1000;

        // Player movement.
        this.updateFromControls(delta_time);

        // cast a ray for picking guy and item placing
        const hit = this.scene.pickWithRay(this.camera.getForwardRay(
            undefined,
            this.camera.getWorldMatrix(),
            this.camera.globalPosition
        ));

        if(this.tempObject && this.tempObjectHelper) {
            if(hit && hit.pickedPoint) {
                const point = hit.pickedPoint;
                this.tempObjectPos.set(point.x, point.y + this.tempObjectOffsetY, point.z);
                this.tempObjectHelper.posUpdate(this.tempObjectPos);
            }

            // TODO: update only when state changed!!!!
            if(this.currentPlace && this.currentPlace.getPermissions.hasPlaceItems() && this.currentPlace.isInBounds(this.tempObject)) {
                this.tempObject.setEnabled(true);
                this.tempObjectHelper.setValid(true);
            } else {
                this.tempObject.setEnabled(false);
                this.tempObjectHelper.setValid(false);
            }
        } else if (hit) {
            // TODO: await this somehow?
            this.pickingGui.updatePickingGui(hit.pickedMesh, hit.distance);
        }
    }
}