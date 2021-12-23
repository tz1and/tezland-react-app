import {
    Skeleton,
    Vector3,
    Mesh,
    Node,
    Scene,
    Ray,
    PickingInfo,
    AnimationGroup,
    TransformNode,
    Matrix,
    TargetedAnimation,
    UniversalCamera,
    Camera
} from "@babylonjs/core"
import { Action } from "@babylonjs/core/Actions/action";

export class QuakeController {
    //private avatar: Mesh = null;;
    //private skeleton: Skeleton = null;
    private camera: Camera;
    private state: ControllerState;

    private beforeRenderer: () => void;
    private handleKeyUp: (e: KeyboardEvent) => void;
    private handleKeyDown: (e: KeyboardEvent) => void;

    private scene: Scene;
    public getScene(): Scene {
        return this.scene;
    }

    constructor(avatar: Mesh, camera: Camera, scene: Scene, actionMap?: {}, faceForward = false) {
        this.camera = camera;
        this.scene = scene;

        /*let success = this.setAvatar(avatar, faceForward);
        if (!success) {
            console.error("unable to set avatar");
        }*/

        this.state = new ControllerState();

        this.beforeRenderer = () => { this.updateController() };
        this.handleKeyUp = (e) => { this.onKeyUp(e) };
        this.handleKeyDown = (e) => { this.onKeyDown(e) };

        let canvas = this.scene.getEngine().getRenderingCanvas();
        /*canvas!.addEventListener("keyup", this.handleKeyUp, false);
        canvas!.addEventListener("keydown", this.handleKeyDown, false);*/
    }

    private onKeyDown(e: KeyboardEvent) {
        if (!e.key) return;
        if (e.repeat) return;
        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.state.moveForward = true;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                this.state.moveLeft = true;
                break;

            case 'ArrowDown':
            case 'KeyS':
                this.state.moveBackward = true;
                break;

            case 'ArrowRight':
            case 'KeyD':
                this.state.moveRight = true;
                break;

            case 'Space':
                if (this.state.canJump === true) this.state.velocity.y += 350;
                this.state.canJump = false;
                break;
        }
        this.move = this.anyMovement();
    }

    private onKeyUp(e: KeyboardEvent) {
        if (!e.key) return;
        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.state.moveForward = false;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                this.state.moveLeft = false;
                break;

            case 'ArrowDown':
            case 'KeyS':
                this.state.moveBackward = false;
                break;

            case 'ArrowRight':
            case 'KeyD':
                this.state.moveRight = false;
                break;

            /*case 'KeyM': // Opens the mint form
                if (this.camControls.isLocked === true) {
                    this.camControls.unlock();
                    appControlfunctions.loadForm('mint');
                }
                break;

            case 'KeyP': // Opens the place form
                if (this.camControls.isLocked === true) {
                    this.camControls.unlock();
                    appControlfunctions.loadForm('place');
                }
                break;

            case 'KeyI': // Opens the inventory
                if (this.camControls.isLocked === true) {
                    this.camControls.unlock();
                    appControlfunctions.loadForm('inventory');
                }
                break;*/
        }
        this.move = this.anyMovement();
    }

    private rightAxis = new Vector3(1,0,0);
    private forwardAxis = new Vector3(0,0,1);
    private updateController() {
        const delta_time: number = this.scene.getEngine().getDeltaTime() / 1000;

        const speed = 20;

        this.state.velocity.x -= this.state.velocity.x * 10.0 * delta_time;
        this.state.velocity.z -= this.state.velocity.z * 10.0 * delta_time;
        // TODO: implement fly controls
        //if(state.flying) state.velocity.y -= state.velocity.y * 10.0 * delta_time;

        //state.velocity.y -= 9.8 * 100.0 * delta_time; // 100.0 = mass

        this.state.direction.z = Number(this.state.moveForward) - Number(this.state.moveBackward);
        this.state.direction.x = Number(this.state.moveRight) - Number(this.state.moveLeft);
        this.state.direction.normalize(); // this ensures consistent movements in all directions

        if (this.state.moveForward || this.state.moveBackward) this.state.velocity.z -= this.state.direction.z * speed * delta_time;
        if (this.state.moveLeft || this.state.moveRight) this.state.velocity.x -= this.state.direction.x * speed * delta_time;

        /*if (onObject === true) {
        state.velocity.y = Math.max( 0, state.velocity.y );
        state.canJump = true;
        }*/

        /*console.log(this.camera.position);
        console.log(this.camera.getDirection(new Vector3(1,0,0)));
        console.log(this.camera.getDirection(new Vector3(1,0,0)).scale(-this.state.velocity.x * delta_time));*/
        this.camera.position.addInPlace(this.camera.getDirection(this.rightAxis).scale(-this.state.velocity.x * delta_time));
        this.camera.position.addInPlace(this.camera.getDirection(this.forwardAxis).scale(-this.state.velocity.z * delta_time));
        //this.camera.position.z += - this.state.velocity.z * delta_time;
        //console.log(this.camera.position);

        //console.log(this.camera.position);

        /*this.camControls.moveRight(- this.state.velocity.x * delta_time);
        this.camControls.moveForward(- this.state.velocity.z * delta_time);

        this.camControls.getObject().position.y += (this.state.velocity.y * delta_time); // new behavior*/

        /*if (camControls.getObject().position.y < 10) {
        state.velocity.y = 0;
        camControls.getObject().position.y = 10;
    
        state.canJump = true;
        }*/
    }

    private move: boolean = false;
    public anyMovement(): boolean {
        return (this.state.moveBackward || this.state.moveBackward || this.state.moveLeft || this.state.moveRight);
    }

    private started: boolean = false;
    public start() {
        if (this.started) return;
        this.started = true;
        this.state.reset();
        /*this._movFallTime = 0;
        //first time we enter render loop, delta time is zero
        this._idleFallTime = 0.001;
        this._grounded = false;
        this._updateTargetValue();
        this.enableKeyBoard(true);*/
        this.scene.registerBeforeRender(this.beforeRenderer);
    }
};

class ControllerState {
    public moveForward: boolean; //: false,
    public moveBackward: boolean; //: false,
    public moveLeft: boolean; //: false,
    public moveRight: boolean; //: false,
    public canJump: boolean; //: false,
    public velocity: Vector3; //: new THREE.Vector3(),
    public direction: Vector3; //: new THREE.Vector3(),
    public flying: boolean; //: true

    constructor() {
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.velocity = new Vector3();
        this.direction = new Vector3();
        this.flying = true;
    }

    reset() {
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.velocity = new Vector3();
        this.direction = new Vector3();
        this.flying = true;
    }
};
