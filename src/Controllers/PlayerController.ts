import { BoundingBox, Camera, IWheelEvent, KeyboardEventTypes, Mesh, Node, Nullable, PointerEventTypes, Quaternion, Scene, ShadowGenerator, TransformNode, Vector3 } from "@babylonjs/core";
import { SimpleMaterial } from "@babylonjs/materials/simple";
import Contracts from "../tz/Contracts";
import { containsBox } from "../tz/Utils";
import * as ipfs from "../ipfs/ipfs";


export default class PlayerController {
    private camera: Camera;
    private scene: Scene;
    private shadowGenerator: ShadowGenerator;

    private tempObject: Nullable<Mesh>;
    private tempObjectOffsetY: number;
    private tempObjectRot: Quaternion;
    //private state: ControllerState;

    private beforeRenderer: () => void;
    /*private handleKeyUp: (e: KeyboardEvent) => void;
    private handleKeyDown: (e: KeyboardEvent) => void;*/

    private isPointerLocked: boolean = false;
    private currentPlace: number = 1;
    private currentItem: number = 3;

    constructor(camera: Camera, scene: Scene, shadowGenerator: ShadowGenerator) {
        this.camera = camera;
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.tempObject = null;
        this.tempObjectOffsetY = 0;
        this.tempObjectRot = new Quaternion();

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
        this.scene.onPointerObservable.add(async (info, eventState) => {
            if (info.type === PointerEventTypes.POINTERDOWN) {
                if(this.tempObject && this.tempObject.isEnabled()) {

                    // TODO: somehow figure out the place the player is inside of
                    // or placing the item inside.
                    const parent = scene.getNodeByName(`place${this.currentPlace}`) as TransformNode;

                    const newObject = await ipfs.download_item(this.currentItem, this.scene, parent) as Mesh;
                    newObject.position = this.tempObject.position.clone();
                    newObject.rotationQuaternion = this.tempObjectRot.clone();
                    newObject.scaling = this.tempObject.scaling.clone();
                    newObject.metadata = { itemId: this.currentItem }

                    // TODO: clicking places new object
                    // check place permissions, etc, move to new function
                    /*const newMat = new SimpleMaterial("newMat", this.scene);
                    newMat.diffuseColor.set(0.8, 0.2, 0.2);

                    const newObject = Mesh.CreateBox("newObject", 1, this.scene);
                    newObject.parent = parent;
                    newObject.material = newMat;//scene.getMaterialByName("defaulMat");
                    newObject.position = this.tempObject.position.clone();
                    newObject.checkCollisions = true;
                    newObject.useOctreeForCollisions = true;*/
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
                // TEMP: switch item in inventory
                if(kbInfo.event.code == "Digit1") {
                    this.setCurrentItem(0);
                    eventState.skipNextObservers = true;
                }
                else if(kbInfo.event.code == "Digit2") {
                    this.setCurrentItem(1);
                    eventState.skipNextObservers = true;
                }
                else if(kbInfo.event.code == "Digit3") {
                    this.setCurrentItem(2);
                    eventState.skipNextObservers = true;
                }
                else if(kbInfo.event.code == "Digit4") {
                    this.setCurrentItem(3);
                    eventState.skipNextObservers = true;
                }
                // Scale
                else if(kbInfo.event.code == "KeyR") {
                    this.tempObject?.scaling.multiplyInPlace(new Vector3(1.1, 1.1, 1.1));
                    eventState.skipNextObservers = true;
                }
                else if(kbInfo.event.code == "KeyF") {
                    this.tempObject?.scaling.multiplyInPlace(new Vector3(0.9, 0.9, 0.9));
                    eventState.skipNextObservers = true;
                }
                // Rotate
                else if(kbInfo.event.code == "KeyE") {
                    this.tempObject?.rotateAround(new Vector3(), new Vector3(0,1,0), Math.PI / 20);
                    eventState.skipNextObservers = true;
                }
                else if(kbInfo.event.code == "KeyQ") {
                    this.tempObject?.rotateAround(new Vector3(), new Vector3(0,1,0), -Math.PI / 20);
                    eventState.skipNextObservers = true;
                }
                // Save place
                else if(kbInfo.event.code == "KeyU") {
                    const parent = scene.getNodeByName(`place${this.currentPlace}`);

                    // try to save items.
                    // TODO: figure out removals.
                    const children = parent!.getChildren();
                    const add_children = new Array<Node>();

                    children.forEach((child) => {
                        if(child.metadata.id == undefined) {
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

    public async setCurrentItem(item_id: number) {
        // remove old object.
        if(this.tempObject) this.tempObject.dispose();

        this.currentItem = item_id;
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
    }

    private updateController() {
        const delta_time: number = this.scene.getEngine().getDeltaTime() / 1000;

        const placeBounds = this.scene.getNodeByName(`placeBounds${this.currentPlace}`) as Mesh;

        if(this.tempObject && placeBounds) {
            const hit = this.scene.pickWithRay(this.camera.getForwardRay());
            if(hit && hit.pickedPoint) {
                const point = hit.pickedPoint;
                this.tempObject.position.set(point.x, point.y + this.tempObjectOffsetY, point.z);
            }

            // Check if the object is contained in the place.
            const {min, max} = this.tempObject.getHierarchyBoundingVectors(true);
            const bbox = new BoundingBox(min, max);
            const placebbox = placeBounds.getBoundingInfo().boundingBox;

            // todo: do this differently maybe. instead of dirtying the object
            // literally every frame.
            if(!containsBox(placebbox, bbox)) {
                this.tempObject.setEnabled(false);
                //this.tempObject.material!.alpha = 0.2;
            } else {
                this.tempObject.setEnabled(true);
                //this.tempObject.material!.alpha = 1;
            }
        }
    }
}