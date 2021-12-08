import { Camera, IWheelEvent, Mesh, Nullable, PointerEventTypes, Scene, ShadowGenerator } from "@babylonjs/core";
import { SimpleMaterial } from "@babylonjs/materials/simple";


export default class PlayerController {
    private camera: Camera;
    private scene: Scene;
    private shadowGenerator: ShadowGenerator;

    private tempObject: Nullable<Mesh>;
    private tempObjectOffsetY: number;
    //private state: ControllerState;

    /*private handleKeyUp: (e: KeyboardEvent) => void;
    private handleKeyDown: (e: KeyboardEvent) => void;*/

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

        this.scene.registerBeforeRender(() => { this.updateController() });

        this.scene.onPointerObservable.add((info, eventState) => {
            if (info.type === PointerEventTypes.POINTERDOWN) {
                if(this.tempObject) {
                    // TODO: clicking places new object
                    // check place permissions, etc, move to new function
                    const newMat = new SimpleMaterial("newMat", this.scene);
                    newMat.diffuseColor.set(0.8, 0.2, 0.2);

                    const newObject = Mesh.CreateBox("newObject", 1, this.scene);
                    newObject.material = newMat;//scene.getMaterialByName("defaulMat");
                    newObject.position = this.tempObject.position;
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