import { Color3, DeepImmutable, Mesh, Quaternion, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import { SimpleMaterial } from "@babylonjs/materials";
import ItemNode from "../world/nodes/ItemNode";


// TODO: remove this and use ItemNode.createBoundingBoxHelper instead.
export default class TempObjectHelper {

    public readonly node: TransformNode;
    public readonly material: SimpleMaterial;
    private cube: Mesh;

    private colorInvalid = new Color3(0.8,0.2,0.2);
    private colorValid = new Color3(0.2,0.8,0.2);

    constructor(scene: Scene, quat: Quaternion) {
        this.material = new SimpleMaterial("transp", scene);
        this.material.alpha = 0.2;
        this.material.backFaceCulling = false;
        this.material.diffuseColor.set(0.2, 0.8, 0.2);

        this.node = new TransformNode("tempObjectHelper", scene);
        this.node.rotationQuaternion = quat;

        // positioning helper.
        this.cube = Mesh.CreateBox("cube", 1, scene, false);
        this.cube.isPickable = false;
        this.cube.parent = this.node;
        this.cube.material = this.material;
    }

    public dispose() {
        this.cube.dispose();
        this.material.dispose();
        this.node.dispose();
    }

    public modelUpdate(mesh: ItemNode) {
        const {min, max} = mesh.getHierarchyBoundingVectors(true);
        const extent = max.subtract(min);
        this.cube.scaling = extent;

        // TODO: what does this do?
        this.cube.position = min.add(extent.multiplyByFloats(0.5, 0.5, 0.5)).subtract(mesh.position);
    }

    public scaleUpdate(scale: number) {
        // TODO: why does this need to be 0.5.
        this.node.scaling.setAll(scale*0.5);
    }

    public posUpdate(pos: DeepImmutable<Vector3>) {
        this.node.position.copyFrom(pos);
    }

    public setValid(isValid: boolean) {
        this.material.diffuseColor = isValid ? this.colorValid : this.colorInvalid;
    }
}