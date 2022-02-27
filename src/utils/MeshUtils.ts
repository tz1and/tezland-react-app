import { Material, Mesh, MeshBuilder, Scene, Vector3 } from "@babylonjs/core";
import earcut from "earcut";

export const extrudeMeshFromShape = (shape: Vector3[], depth: number, pos: Vector3,
    mat: Material, name: string, scene: Scene): Mesh => {
    
    const extrude = MeshBuilder.ExtrudePolygon(name, {
        shape: shape,
        depth: depth
    }, scene, earcut);

    extrude.material = mat;
    extrude.position = pos;
    extrude.isPickable = false;

    return extrude;
}