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
import PlaceKey, { getPlaceType, PlaceType } from "../utils/PlaceKey";
import WorldLocation from "../utils/WorldLocation";
import { ImportedWorldDef } from "../world/ImportWorldDef";

const Gravity = 9.81;
const GravityUnderwater = -0.05;

const PlayerMass = 0.5;
const PlayerAccel = 200.0; // m/s?
const PlayerJumpVel = 7;

const PlayerGroundFriction = 6.0;
const PlayerWaterFriction = 2.5;
const PlayerFlyFriction = 2.0;
const PlayerMaxJogVel = 4;
const PlayerMaxWalkVel = 2;
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
    private walk: boolean = false;

    public freeze: boolean = true;

    private static readonly BODY_HEIGHT = 1.5;
    private static readonly LEGS_HEIGHT = 0.3;

    public isUnderwater: boolean = false;

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

        // Ellipsoid for debugging.
        /*var ellipsoid = MeshBuilder.CreateCylinder("debug", {diameter: (this.playerTrigger.ellipsoid.x *2), height: (this.playerTrigger.ellipsoid.y * 2), subdivisions: 24}, this.scene);
        ellipsoid.position.copyFrom(this.playerTrigger.position);
        ellipsoid.position.addInPlace(this.playerTrigger.ellipsoidOffset);
        ellipsoid.parent = this.playerTrigger;*/

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
        assert(getPlaceType(place_key.fa2) !== PlaceType.Unknown, "Teleportation to unknown place type");

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

    /**
     * Teleports player to location, assumed to be in the the current World.
     * @param location The location, in the current World.
     * @returns 
     */
    public teleportToLocal(location: WorldLocation) {
        if (!location.isValid()) {
            Logging.Error("Invalid teleport location");
            return;
        }

        if (location.pos) this.teleportToWorldPos(location.pos);
        else if (location.district) this.teleportToDistrict(location.district);
        else if (location.placeKey) this.teleportToPlace(location.placeKey).catch(() => {
            this.teleportToWorldPos(new Vector3(0, 0, 0));
        });
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
        // position the raycast from top center of ellipsoid
        let raycastFloorPos = new Vector3(
            this.playerTrigger.position.x + offsetx,
            this.playerTrigger.position.y + PlayerController.LEGS_HEIGHT + PlayerController.BODY_HEIGHT - 0.01,
            this.playerTrigger.position.z + offsetz);
        let ray = new Ray(raycastFloorPos, Vector3.Down(), raycastlen);

        // Only collide with meshes that have collision enabled.
        let pick = this.scene.pickWithRay(ray, m => m.checkCollisions);

        if (pick && pick.hit) {
            return pick.distance;
        } else {
            return Infinity;
        }
    }

    private static readonly EPSILON = 0.000001;

    private groundPlayer(): boolean {
        const dist_to_ground = this.floorRaycast(0, 0);
        // If less than leg height, adjust position.
        const raycast_from = PlayerController.LEGS_HEIGHT + PlayerController.BODY_HEIGHT - 0.01;
        if (isEpsilonEqual(dist_to_ground, raycast_from, PlayerController.EPSILON))
            return true;

        if(dist_to_ground < raycast_from) {
            this.playerTrigger.position.y += raycast_from - dist_to_ground;
            return true;
        }
        
        return false;
    }

    private position_prev_frame: Vector3 = new Vector3();
    private position_prev_flymode: Vector3 = new Vector3();

    private updateFromControls(delta_time: number): void {
        // Get inputs
        this.input.checkInputs();
        const moveFwd = this.input.forward; //fwd, z
        const moveRight = this.input.right; //right, x
        const moveUp = this.input.up; // up, y

        // If there was input.
        if (moveFwd !== 0 || moveRight !== 0 || moveUp !== 0) {
            // Un-freeze player.
            this.freeze = false;
            // Update last user input.
            this.updateLastUserInput();
        }

        // If player is frozen, no need to process physics.
        if (this.freeze) return;

        const allAxes = this._flyMode || this.isUnderwater;

        // Figure out directions.
        const cam_dir = this.camera.getDirection(Axis.Z);
        const right = Vector3.Cross(Vector3.Up(), cam_dir);
        const fwd = allAxes ? cam_dir : Vector3.Cross(right, Vector3.Up());

        //this.forces.setAll(0);

        // Reference: https://gamedev.stackexchange.com/questions/15708/how-can-i-implement-gravity/16466#16466

        // gravity
        let gravity;
        if (this._flyMode) gravity = 0;
        else if (this.isUnderwater) gravity = GravityUnderwater;
        else gravity = Gravity;
        const forces: Vector3 = Vector3.DownReadOnly.scale(gravity);

        // left/right movement
        const movement_forces = right.scale(moveRight);
        // forward/backward movement
        movement_forces.addInPlace(fwd.scale(moveFwd));
        // up/down movement
        if (allAxes) movement_forces.addInPlace(Vector3.Up().scale(moveUp));
        movement_forces.normalize();

        forces.addInPlace(movement_forces.scale(PlayerAccel));

        // add other forces in for taste - usual suspects include air resistence
        // proportional to the square of velocity, against the direction of movement. 
        // this has the effect of capping max speed.

        // Player velocity.
        const acceleration: Vector3 = forces.scale(1 / PlayerMass);
        this.velocity.addInPlace(acceleration.scale(delta_time));

        // Get the distance to ground
        const grounded = this.groundPlayer();

        if (!allAxes && grounded) this.velocity.y = 0;

        // If grounded, we can jump.
        if (!allAxes && grounded && this.input.jump) {
            this.velocity.y = PlayerJumpVel;
        }

        // We can early out sometimes.
        if (isEpsilonEqual(this.velocity.x, 0, PlayerController.EPSILON) &&
            isEpsilonEqual(this.velocity.y, 0, PlayerController.EPSILON) &&
            isEpsilonEqual(this.velocity.z, 0, PlayerController.EPSILON)) return;

        // Limit max speed.
        // TODO: this is wrong. but good enoug for now...
        (() => {
            const vec = this.velocity.clone();

            const speed = vec.length();
            if (isEpsilonEqual(speed, 0, PlayerController.EPSILON)) {
                return;
            }

            const playerMaxVel = (this.walk ? PlayerMaxWalkVel : PlayerMaxJogVel) * (this._flyMode ? PlayerFlySpeedMult : 1);

            const newspeed = Math.min(speed, playerMaxVel) / speed;
            this.velocity.x = vec.x * newspeed;
            if (allAxes) this.velocity.y = vec.y * newspeed;
            this.velocity.z = vec.z * newspeed;
        })();

        // TODO: obstacles should affect velocity!
        // Work that out based on distance travlled before and after moveWithCollisions.
        // Actually, that doesn't work, velocity will invert when teleporting happens with moveWithCollisions.
        // This is dumb.
        this.position_prev_frame.copyFrom(this.playerTrigger.position);

        const displacement_vector = this.velocity.scale(delta_time);

        assert(!isNaN(displacement_vector.x), "x was NaN");
        assert(!isNaN(displacement_vector.y), "y was NaN");
        assert(!isNaN(displacement_vector.z), "z was NaN");

        this.playerTrigger.moveWithCollisions(displacement_vector);

        // Velocity after collision is position - prev position.
        // Probably don't need to do this. Works almost exactly the same as before.
        // TODO: need to limit velocity somehow. probably could:
        // - figure out the actual displacement vector after collision
        // - figure out what the velocity should be with respect to delta time.
        /*const actual_displacement_vector = this.playerTrigger.position.subtract(this.position_prev_frame);
        const actual_velocity = actual_displacement_vector.scale(1 / delta_time);
        //console.log(this.velocity, actual_velocity)
        this.velocity.set(actual_velocity.x, this.velocity.y, actual_velocity.z);*/
        //this.playerTrigger.position.subtractToRef(this.position_prev_frame, this.velocity);

        // ground player again after applying forces.
        this.groundPlayer();

        // Friction.
        // TODO: friction is a bit broken
        // This is basically what Q3 does.
        (() => {
            const vec = this.velocity.clone();
            if (allAxes) vec.y = 0;

            const speed = vec.length();
            if (isEpsilonEqual(speed, 0, PlayerController.EPSILON)) {
                this.velocity.x = 0;
                this.velocity.z = 0;
                return;
            }

            let drop = 0;
            if (grounded && !this.isUnderwater) {
                drop += speed*PlayerGroundFriction*delta_time;
            }

            if (this.isUnderwater) drop += speed*PlayerWaterFriction*delta_time;

            if (this._flyMode) drop += speed*PlayerFlyFriction*delta_time;

            // scale the velocity, must be > 0.
            const newspeed = Math.max(speed - drop, 0) / speed;
            this.velocity.scaleInPlace(newspeed);
        })();

        //Logging.InfoDev(this.velocity);

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

        // cast a ray for picking gui and item placing
        const hit = this.scene.pickWithRay(this.camera.getForwardRay(
            maxPickDistance,
            this.camera.getWorldMatrix(),
            this.camera.globalPosition
        ), (mesh) => {
            // This predicate is to make sure the ground in interiors
            // is pickable even if it's disabled.
            return mesh.isPickable && (mesh.isEnabled() || mesh.name === "interiorGround");
        });

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