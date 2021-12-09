import { Camera, IWheelEvent, KeyboardEventTypes, Mesh, Node, Nullable, PointerEventTypes, Scene, ShadowGenerator } from "@babylonjs/core";
import { SimpleMaterial } from "@babylonjs/materials/simple";
import Contracts from "../tz/Contracts";


export default class PlayerController {
    private camera: Camera;
    private scene: Scene;
    private shadowGenerator: ShadowGenerator;

    private tempObject: Nullable<Mesh>;
    private tempObjectOffsetY: number;
    //private state: ControllerState;

    private beforeRenderer: () => void;
    /*private handleKeyUp: (e: KeyboardEvent) => void;
    private handleKeyDown: (e: KeyboardEvent) => void;*/

    private isPointerLocked: boolean = false;
    private currentPlace: number = 1;

    constructor(camera: Camera, scene: Scene, shadowGenerator: ShadowGenerator) {
        this.camera = camera;
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.tempObject = null;
        this.tempObjectOffsetY = 0;

        const transparent_mat = new SimpleMaterial("tranp", this.scene);
        //transparent_mat.alpha = 0.2;
        //transparent_mat.disableLighting = true;
        //transparent_mat.backFaceCulling = false;
        transparent_mat.diffuseColor.set(0.8, 0.2, 0.2);

        this.tempObject = Mesh.CreateBox("tempObject", 1, this.scene);
        this.tempObject.material = transparent_mat;
        this.tempObject.isPickable = false;
        shadowGenerator.addShadowCaster(this.tempObject);

        this.beforeRenderer = () => { this.updateController() };
        this.scene.registerBeforeRender(this.beforeRenderer);

        // Pointer lock stuff
        const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
        this.scene.onPointerObservable.add((event, eventState) => {
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
        }, PointerEventTypes.POINTERDOWN, true); // insert first

        // Event listener when the pointerlock is updated (or removed by pressing ESC for example).
        var pointerlockchange = () => {
            /* document.mozPointerLockElement || document.webkitPointerLockElement || document.msPointerLockElement ||  */
            var controlEnabled = document.pointerLockElement || null;
            
            // If the user is already locked
            if (!controlEnabled) {
                this.camera.detachControl(canvas);
                this.isPointerLocked = false;
            } else {
                this.camera.attachControl(canvas);
                this.isPointerLocked = true;
            }
        };

        // Attach events to the document
        document.addEventListener("pointerlockchange", pointerlockchange, false);

        // mouse interaction when locked
        this.scene.onPointerObservable.add((info, eventState) => {
            if (info.type === PointerEventTypes.POINTERDOWN) {
                if(this.tempObject) {
                    // TODO: clicking places new object
                    // check place permissions, etc, move to new function
                    const newMat = new SimpleMaterial("newMat", this.scene);
                    newMat.diffuseColor.set(0.8, 0.2, 0.2);

                    // TODO: somehow figure out the place the player is inside of
                    // or placing the item inside.
                    const parent = scene.getNodeByName(`place${this.currentPlace}`);

                    const newObject = Mesh.CreateBox("newObject", 1, this.scene);
                    newObject.parent = parent;
                    newObject.material = newMat;//scene.getMaterialByName("defaulMat");
                    newObject.position = this.tempObject.position.clone();
                    newObject.checkCollisions = true;
                    newObject.useOctreeForCollisions = true;
                    shadowGenerator.addShadowCaster(newObject);

                    eventState.skipNextObservers = true;
                }
            }
            else if (info.type === PointerEventTypes.POINTERWHEEL) {
                var event = <IWheelEvent>info.event;
                this.tempObjectOffsetY += event.deltaY * -0.001;

                eventState.skipNextObservers = true;
            }
        });

        // Keyboard controls. Save, remove, place, mint, whatever.
        scene.onKeyboardObservable.add((kbInfo, eventState) => {
            if(kbInfo.type == KeyboardEventTypes.KEYDOWN){
                if(kbInfo.event.code == "KeyS") {
                    const parent = scene.getNodeByName(`place${this.currentPlace}`);

                    // try to save items.
                    // TODO: figure out removals.
                    const children = parent!.getChildren();
                    const add_children = new Array<Node>();

                    children.forEach((child) => {
                        if(child.metadata == undefined) {
                            add_children.push(child);
                        }
                    });

                    // exit pointer lock and send operation.
                    document.exitPointerLock();

                    Contracts.saveItems(new Array<any>(), add_children, this.currentPlace);

                    eventState.skipNextObservers = true;
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
        });
    }

    private updateController() {
        const delta_time: number = this.scene.getEngine().getDeltaTime() / 1000;

        const hit = this.scene.pickWithRay(this.camera.getForwardRay());
        if(this.tempObject && hit && hit.pickedPoint) {
            const point = hit.pickedPoint;
            this.tempObject.position.set(point.x, point.y + this.tempObjectOffsetY, point.z);
        }
    }
}