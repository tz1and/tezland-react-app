import { Material, Mesh, MeshBuilder, Scene, Vector3 } from "@babylonjs/core";
import earcut from "earcut";

export namespace MeshUtils {

    export const extrudeMeshFromShape = (shape: Vector3[], depth: number, pos: Vector3,
        mat: Material, name: string, scene: Scene, sideOrientation: number = Mesh.DEFAULTSIDE,
        pickable: boolean = false): Mesh => {
        
        const extrude = MeshBuilder.ExtrudePolygon(name, {
            shape: shape,
            depth: depth,
            sideOrientation: sideOrientation,
        }, scene, earcut);

        extrude.material = mat;
        extrude.position = pos;
        extrude.isPickable = pickable;

        return extrude;
    }

    export const extrudeShape = (shape: Vector3[], path: Vector3[], pos: Vector3,
        mat: Material, name: string, scene: Scene, sideOrientation: number = Mesh.DEFAULTSIDE,
        pickable: boolean = false): Mesh => {
        
        const extrude = MeshBuilder.ExtrudeShape(name, {
            shape: shape,
            path: path,
            cap: Mesh.NO_CAP,
            closePath: true,
            sideOrientation: sideOrientation,
        }, scene);

        extrude.material = mat;
        extrude.position = pos;
        extrude.isPickable = pickable;

        return extrude;
    }

}