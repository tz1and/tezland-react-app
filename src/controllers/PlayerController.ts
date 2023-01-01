import { Angle, Axis, EventState, FreeCamera, KeyboardEventTypes,
    KeyboardInfo, Mesh, Nullable, Ray, Scene,
    Tools, Vector2, Vector3 } from "@babylonjs/core";
import assert from "assert";
import AppSettings from "../storage/AppSettings";
import { Logging } from "../utils/Logging";
import { downloadFile, isDev, isEpsilonEqual } from "../utils/Utils";
import { AppControlFunctions, DirectoryFormProps, OverlayForm } from "../world/AppControlFunctions";
import Metadata from "../world/Metadata";
import BasePlaceNode from "../world/nodes/BasePlaceNode";
import { Game } from "../world/Game";
import GuiController, { CursorType } from "./GuiController";
import { PlayerKeyboardInput } from "./PlayerInput";
import UserControllerManager from "./UserControllerManager";
import ItemPlacementController from "./ItemPlacementController";
import TokenKey from "../utils/TokenKey";
import PlaceKey from "../utils/PlaceKey";
import { UrlLocationParser } from "../utils/UrlLocationParser";
import WorldLocation from "../utils/WorldLocation";
import { ImportedWorldDef } from "../world/ImportWorldDef";


const PlayerWalkSpeed = 2; // m/s
const PlayerJogSpeed = 4.0; // m/s
const PlayerFlySpeedMult = isDev() ? 10.0 : 1.2;
const LimitFlyDistance = !isDev();
const UnglitchCooldown = 10000; // 10s

export default class PlayerController {
    readonly camera: FreeCamera;
    readonly appControlFunctions: AppControlFunctions;
    readonly game: Game;
    readonly scene: Scene;

    readonly gui: GuiController;
    private controllerManager: UserControllerManager;

    readonly playerTrigger: Mesh;

    private input: PlayerKeyboardInput;
    private velocity: Vector3 = new Vector3();
    private gravity: Vector3 = new Vector3();
    private walk: boolean = false;

    private static readonly GRAVITY = 0.225;
    private static readonly BODY_HEIGHT = 1.5;
    private static readonly LEGS_HEIGHT = 0.3;
    private static readonly JUMP_VEL = 0.07;

    private _flyMode: boolean;
    public get flyMode(): boolean { return this._flyMode; }

    //private isPointerLocked: boolean = false; // TODO: still needed for something?
    private _currentPlace: Nullable<BasePlaceNode>;

    private onPointerlockChange: () => void;
    private onPointerlockError: () => void;

    private last_unglitch_time: number = 0;

    constructor(game: Game, appControlFunctions: AppControlFunctions) {
        this.appControlFunctions = appControlFunctions;
        this.game = game;
        this.scene = game.scene;
        this._currentPlace = null;

        this.gui = new GuiController();
        this.controllerManager = new UserControllerManager();
        this.controllerManager.activate("picking", this);
        this._flyMode = false;
        this.camera = this.initCamera();

        this.input = new PlayerKeyboardInput();
        this.input.keysLeft = [65 /*w*/, 37 /*left arrow*/];
        this.input.keysRight = [68 /*d*/, 39 /*right arrow*/];
        this.input.keysUp = [87 /*w*/, 38 /*up arrow*/];
        this.input.keysDown = [83 /*s*/, 40 /*down arrow*/];
        // NOTE: upward is also handled by "jump"
        this.input.keysUpward = [];
        this.input.keysDownward = [86/*v*/];

        // Mesh builder :  {height: PlayerController.BODY_HEIGHT, radius: 0.5, updatable: false}
        this.playerTrigger = new Mesh("player", this.scene);
        this.playerTrigger.ellipsoid = new Vector3(0.375, PlayerController.BODY_HEIGHT * 0.5, 0.375);
        this.playerTrigger.ellipsoidOffset.set(0, PlayerController.LEGS_HEIGHT + (PlayerController.BODY_HEIGHT * 0.5), 0);
        this.playerTrigger.isPickable = false;
        this.playerTrigger.isVisible = false;
        //this.playerTrigger.actionManager = new ActionManager(this.scene);
        this.camera.parent = this.playerTrigger;

        this.camera.onViewMatrixChangedObservable.add(this.updateLastUserInput);

        // NOTE: the bounding info seems to get bugged for some reason.
        // We need to update it here, otherwise collisions will be incorrect!
        this.playerTrigger.refreshBoundingInfo();

        this.scene.registerAfterRender(this.updateController);

        // Event listener when the pointerlock is updated (or removed by pressing ESC for example).
        this.onPointerlockChange = () => {
            var controlEnabled = document.pointerLockElement || null;
            
            // If the user is already locked
            if (!controlEnabled) {
                // blur canvas to stop keyboard events.
                this.scene.getEngine().getRenderingCanvas()?.blur();
                this.camera.detachControl();
                this.input.detachControl();
                //this.isPointerLocked = false;
                this.appControlFunctions.unlockControls();
            } else {
                // focus on canvas for keyboard input to work.
                this.scene.getEngine().getRenderingCanvas()?.focus();
                this.camera.attachControl();
                this.input.attachControl(this.scene);
                //this.isPointerLocked = true;
            }
        };

        // Catch pointerlock errors to not get stuck
        this.onPointerlockError = () => {
            Logging.Error("Pointerlock request failed.");
            this.appControlFunctions.loadForm(OverlayForm.Instructions);
        };

        // add pointerlock event listeners
        document.addEventListener("pointerlockchange", this.onPointerlockChange, false);
        document.addEventListener("pointerlockerror", this.onPointerlockError, false);

        // Keyboard controls. Save, remove, place, mint, whatever.
        this.scene.onKeyboardObservable.add((kbInfo: KeyboardInfo, eventState: EventState) => {
            if(kbInfo.type === KeyboardEventTypes.KEYUP) {
                switch(kbInfo.event.code) {
                    // Scale
                    case "ShiftLeft":
                        this.walk = false;
                        break;
                }
            }
            else if(kbInfo.type === KeyboardEventTypes.KEYDOWN) {
                // TEMP: switch item in inventory
                switch(kbInfo.event.code) {
                    // Save place
                    case "KeyU":
                        if(this._currentPlace) {
                            // We don't check permissions because removing of own items is always allowed.
                            // Permissions are checked when placing/marking for removal instead.
                            if(this._currentPlace.save())
                                document.exitPointerLock();
                        }
                        break;
                    
                    // Opens the mint form
                    case 'KeyM':
                        document.exitPointerLock();
                        this.appControlFunctions.loadForm(OverlayForm.Mint);
                        break;

                    // Opens the place properties form
                    case 'KeyP':
                        if(this._currentPlace && this._currentPlace.placeData) {
                            if (this._currentPlace.getPermissions.hasProps()) {
                                document.exitPointerLock();
                                // NOTE: we just assume, placeInfo in Explore is up to date.
                                this.appControlFunctions.loadForm(OverlayForm.PlaceProperties);
                            } else {
                                this.appControlFunctions.addNotification({
                                    id: "permissionsProps" + this._currentPlace.placeKey.id,
                                    title: "No permission",
                                    body: `You don't have permission to edit the properties of this place.`,
                                    type: 'info'
                                });
                            }
                        }
                        break;

                    // Opens the inventory
                    case 'KeyI':
                        document.exitPointerLock();
                        this.appControlFunctions.loadForm(OverlayForm.Inventory);
                        break;

                    // Clear item selection
                    case 'KeyC':
                        this.controllerManager.activate("picking", this);
                        eventState.skipNextObservers = true;
                        break;

                    // Toggle fly mode
                    case 'KeyG':
                        this.toggleFlyMode();
                        break;

                    /*case 'KeyB':
                        chrome.bookmarks.create({
                            title: "bookmarks.create() on MDN",
                            url: "https://developer.mozilla.org/Add-ons/WebExtensions/API/bookmarks/create"
                        }, () => {
                            document.exitPointerLock();
                        });
                        break;*/

                    case 'ShiftLeft': // Enable walk
                        this.walk = true;
                        break;

                    case 'KeyX':
                        if (performance.now() - this.last_unglitch_time > UnglitchCooldown) {
                            this.last_unglitch_time = performance.now();
                            const dir = this.camera.getForwardRay().direction.multiplyByFloats(1,0,1).normalize().scale(2);
                            this.teleportToWorldPos(this.playerTrigger.position.add(dir));
                        }
                        break;

                    case 'F10': // Screenshot
                        // TODO: Sometimes screenshots are empty. Same issue as in ModelPreview.
                        const engine = this.scene.getEngine();
                        const canvas = engine.getRenderingCanvas();
                        assert(canvas, "Engine not attached to a canvas element");

                        Tools.CreateScreenshotUsingRenderTargetAsync(
                            engine, this.scene.activeCamera!,
                            { width: canvas.width, height: canvas.height },
                            "image/png", engine.getCaps().maxSamples, true)
                        .then(res => downloadFile(res, "tz1and_screenshot.png"));
                        break;

                    // Reload place - Dev only
                    case "KeyL":
                        if(isDev() && this._currentPlace) {
                            this._currentPlace.update(true);
                        }
                        break;

                    // Opens directory - Dev only
                    case 'KeyN':
                        if(isDev()) {
                            document.exitPointerLock();
                            this.appControlFunctions.loadForm(OverlayForm.Directory, {
                                mapCoords: [this.playerTrigger.position.x, this.playerTrigger.position.z]
                            } as DirectoryFormProps);
                        }
                        break;
                }
            }
        }, KeyboardEventTypes.KEYDOWN | KeyboardEventTypes.KEYUP);
    }

    private async teleportToPlace(place_key: PlaceKey) {
        const metadata = await Metadata.getPlaceMetadata(place_key.id, place_key.fa2);
        assert(metadata);

        const origin = Vector3.FromArray(metadata.centerCoordinates);
        const p0 = Vector3.FromArray(metadata.borderCoordinates[0]);

        // Position is the first corner + 2m from center.
        p0.addInPlace(origin);
        p0.addInPlace(p0.subtract(origin).normalize().scale(2));
        
        this.teleportToWorldPos(p0);
        
        // Look towards center of place.
        this.camera.setTarget(this.playerTrigger.position.subtract(origin).negate()
            .add(new Vector3(0,(PlayerController.BODY_HEIGHT + PlayerController.LEGS_HEIGHT),0)));
    }

    private teleportToWorldPos(pos: Vector3) {
        if (this._flyMode) this.toggleFlyMode();
        this.playerTrigger.position.copyFrom(pos);
    }

    private teleportToDistrict(district: number) {
        const district_def = ImportedWorldDef.districts[district - 1];
        const spawn = new Vector2(district_def.spawn.x, district_def.spawn.y)
        const center = new Vector2(district_def.center.x, district_def.center.y)
        const spawn_point = spawn.add(center);

        this.teleportToWorldPos(new Vector3(spawn_point.x, 0, spawn_point.y));
    }

    public async teleportToLocation(location: WorldLocation) {
        if (!location.isValid()) {
            Logging.Error("Invalid teleport location");
            return;
        }

        if (location.pos) this.teleportToWorldPos(location.pos);
        else if (location.district) this.teleportToDistrict(location.district);
        else if (location.placeKey) await this.teleportToPlace(location.placeKey);
    }

    public async teleportToSpawn() {
        let location: WorldLocation | undefined;
        try {
            location = UrlLocationParser.parseLocationFromUrl();
        } catch(e) {
            Logging.Error("Failed to parse location from URL:", e);
        }

        if (!location) location = new WorldLocation({placeKey: AppSettings.defaultSpawn.value});

        await this.teleportToLocation(location);
    }

    private initCamera(): FreeCamera {
        // This creates and positions a free camera (non-mesh)
        var camera = new FreeCamera("playerCamera",
            new Vector3(0, PlayerController.LEGS_HEIGHT + PlayerController.BODY_HEIGHT - 0.15, 0),
            this.scene);

        // Camera props
        camera.fovMode = FreeCamera.FOVMODE_HORIZONTAL_FIXED;
        camera.fov = Angle.FromDegrees(AppSettings.fovHorizontal.value).radians();
        camera.minZ = 0.1;
        camera.maxZ = 2000;

        // Collision stuff
        //camera.checkCollisions = true;
        //camera.applyGravity = true;
        //camera.ellipsoid = new Vector3(0.5, PlayerController.BODY_HEIGHT * 0.5, 0.5);

        // Sensibility
        camera.angularSensibility *= 10 / AppSettings.mouseSensitivity.value;
        // TODO: inertia also affects default camera movement...
        camera.inertia *= AppSettings.mouseInertia.value;

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

        this.scene.unregisterAfterRender(this.updateController);

        this.gui.dispose();

        this.controllerManager.deactivate();

        this._currentPlace = null;
    }

    private toggleFlyMode(): void {
        this._flyMode = !this._flyMode;
        
        if (this._flyMode) {
            this.position_prev_flymode.copyFrom(this.playerTrigger.position);
        } else {
            this.playerTrigger.position.copyFrom(this.position_prev_flymode);
        }

        this.velocity.setAll(0);
        this.gravity.setAll(0);
    }

    /**
     * Important: returns a ref to the player position!
     * @returns Vector3
     */
    public getPosition(): Vector3 {
        return this.playerTrigger.position;
    }

    /**
     * Important: returns a ref to the player quaternion!
     * @returns Vector3
     */
    public getRotation(): Vector3 {
        return this.camera.rotation;
    }

    public get currentPlace() { return this._currentPlace; }

    public set currentPlace(place: Nullable<BasePlaceNode>) {
        if (place !== this._currentPlace) {
            this._currentPlace = place;

            if (place) {
                // Update permissions, place info, notifications.
                place.updateOwnerAndPermissions().then(() => {
                    this.appControlFunctions.updatePlaceInfo(place);

                    Logging.InfoDev("entered place: " + place.placeKey.id);

                    place.displayOutOfBoundsItemsNotification();
                });
            }
        }
    }

    public selectItemForPlacement(token_key: TokenKey, quantity: number) {
        const controller = this.controllerManager.activate<ItemPlacementController>("placement", this);

        const world = this.game.getCurrentWorld();
        assert(world, "World not set");
        controller.setCurrentItem(world, token_key, quantity).catch(() => {
            // TODO: handle error
        });
    }

    public handleDroppedFile(file: File) {
        const controller = this.controllerManager.activate<ItemPlacementController>("placement", this);

        const world = this.game.getCurrentWorld();
        assert(world, "World not set");
        controller.setFile(world, file).then(() => {
            // TODO: handle error
        });
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
            const travelled = Vector3.Distance(this.lastPos, this.getPosition());
            this.lastPos = this.getPosition().clone();
            Logging.Log(`Travelled ${travelled}m in ${elapsed}ms`);
        }
    }*/

    //Send raycast to the floor to detect if there are any hits with meshes below the character
    private floorRaycast(offsetx: number, offsetz: number, raycastlen?: number): number {
        // position the raycast from bottom center of ellipsoid
        let raycastFloorPos = new Vector3(this.playerTrigger.position.x + offsetx, this.playerTrigger.position.y + PlayerController.LEGS_HEIGHT, this.playerTrigger.position.z + offsetz);
        let ray = new Ray(raycastFloorPos, Vector3.Down(), raycastlen);

        // Only collide with meshes that have collision enabled.
        let pick = this.scene.pickWithRay(ray, m => m.checkCollisions);

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

    private position_prev_frame: Vector3 = new Vector3();
    private position_prev_flymode: Vector3 = new Vector3();

    private updateFromControls(delta_time: number): void {
        // Get inputs
        this.input.checkInputs();
        const moveFwd = this.input.forward; //fwd, z
        const moveRight = this.input.right; //right, x
        const moveUp = this.input.up; // up, y

        // Update user input if there was any.
        if (moveFwd !== 0 || moveRight !== 0 || moveUp !== 0) this.updateLastUserInput();

        // Figure out directions.
        const cam_dir = this.camera.getDirection(Axis.Z);
        const right = Vector3.Cross(Vector3.Up(), cam_dir);
        const fwd = this._flyMode ? cam_dir : Vector3.Cross(right, Vector3.Up());

        // Player velocity.
        const playerSpeed = (this.walk ? PlayerWalkSpeed : PlayerJogSpeed) * (this._flyMode ? PlayerFlySpeedMult : 1);
        const accel = playerSpeed * delta_time;
        const new_vel = (this._flyMode ?
            fwd.scale(moveFwd).add(right.scale(moveRight)).add(Vector3.Up().scale(moveUp)) :
            fwd.scale(moveFwd).add(right.scale(moveRight))
        ).normalize().scale(accel);
        //this.velocity.scaleInPlace(1 - accel).addInPlace(new_vel);
        this.velocity.copyFrom(new_vel);

        // Not needed if accel and decel are eq.
        /*if(this.velocity.length() > PlayerJogSpeed) {
            console.log("clamping vel");
            this.velocity.normalize().scaleInPlace(PlayerJogSpeed);
        }*/

        // Get the distance to ground
        let dist_to_ground = this.groundPlayer();
        const grounded = isEpsilonEqual(dist_to_ground, PlayerController.LEGS_HEIGHT, PlayerController.EPSILON);

        // TODO: obstacles should affect velocity!
        // Work that out based on distance travlled before and after moveWithCollisions.
        // Actually, that doesn't work, velocity will invert when teleporting happens with moveWithCollisions.
        // This is dumb.
        this.position_prev_frame.copyFrom(this.playerTrigger.position);

        // Fly mode controls
        if (this._flyMode) {
            // no gravity in fly mode
            this.gravity.setAll(0);

            this.playerTrigger.moveWithCollisions(this.velocity);

            // TODO: up/down controls in flymode.
        } else {
            if(!grounded) {
                // increase fall velocity.
                this.gravity.addInPlace(Vector3.Down().scale(delta_time * PlayerController.GRAVITY));
                this.velocity.y = this.gravity.y;
    
                this.playerTrigger.moveWithCollisions(this.velocity);
    
                // ground player again after applying gravity.
                this.groundPlayer();
            } else {
                // reset fall velocity.
                this.gravity.setAll(0);
    
                // If grounded, we can jump.
                if (this.input.jump) {
                    this.gravity.addInPlace(Vector3.Up().scale(PlayerController.JUMP_VEL));
                }
    
                this.velocity.y = this.gravity.y;
    
                this.playerTrigger.moveWithCollisions(this.velocity);
            }
        }

        // This kinda somewhat works but isn't perfect.
        const vel_diff = this.playerTrigger.position.subtract(this.position_prev_frame).subtractInPlace(this.velocity);
        if(!isEpsilonEqual(vel_diff.x, 0, PlayerController.EPSILON))
            this.velocity.x += vel_diff.x;
        if(!isEpsilonEqual(vel_diff.y, 0, PlayerController.EPSILON))
            this.velocity.y += vel_diff.y;
        if(!isEpsilonEqual(vel_diff.z, 0, PlayerController.EPSILON))
            this.velocity.z += vel_diff.z;
        //console.log(this.velocity)
        /*if (Vector3.Dot(vel_actual, this.velocity) < 0) {
            this.playerTrigger.position = pos_before;
            this.velocity.set(0, 0, 0);
        }
        else this.velocity.set(vel_actual.x, 0, vel_actual.z);*/

        // Ensure player can't move too far from body in fly mode
        if (LimitFlyDistance && this._flyMode) {
            const distance_from_body = Vector3.Distance(this.playerTrigger.position, this.position_prev_flymode);
            if (distance_from_body > 50)
                this.playerTrigger.position.copyFrom(Vector3.Lerp(this.position_prev_flymode, this.playerTrigger.position, 50 / distance_from_body));
        }
    }

    private updateController = () => {
        const delta_time: number = this.scene.getEngine().getDeltaTime() / 1000;

        // Player movement.
        this.updateFromControls(delta_time);

        const maxPickDistance = 50; // in m

        // cast a ray for picking guy and item placing
        const hit = this.scene.pickWithRay(this.camera.getForwardRay(
            maxPickDistance,
            this.camera.getWorldMatrix(),
            this.camera.globalPosition
        ));

        this.controllerManager.updateController(hit);
    }

    public setCursor(cursor: CursorType) {
        this.gui.setCursor(cursor);
    }

    /**
     * Time of last user input. Used by world to optimise for performance
     * when there is input.
     */
    public lastUserInputTime: number = 0;

    private updateLastUserInput = () => {
        this.lastUserInputTime = Date.now();
    }
}