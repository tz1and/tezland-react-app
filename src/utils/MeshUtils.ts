import { AbstractMesh, Axis, Material, Mesh, MeshBuilder,
    Ray, Scene, Vector3 } from "@babylonjs/core";
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

    export const pointIsInside = (point: Vector3, mesh: Mesh) => {
        const boundInfo = mesh.getBoundingInfo();
        if(!boundInfo.intersectsPoint(point))
            return false;
    
        const diameter = 2 * boundInfo.boundingSphere.radius;
    
        var pointFound = false;
        var hitCount = 0;
        const ray = new Ray(Vector3.Zero(), Axis.X, diameter);
        const direction = point.clone();
        const refPoint = point.clone();
    
        hitCount = 0;
        ray.origin = refPoint;
        ray.direction = direction;
        ray.length = diameter;
        var pickInfo = ray.intersectsMesh(mesh);
        while (pickInfo.hit) {
            hitCount++;
            pickInfo.pickedPoint!.addToRef(direction.scale(0.00000001), refPoint);
            ray.origin = refPoint;
            pickInfo = ray.intersectsMesh(mesh);
        }   
        if((hitCount % 2) === 1) {
            pointFound = true;
        }
        
        return pointFound;
    }

    export const countPolygons = (meshes: AbstractMesh[]): number => {
        let polycount = 0;
        for(const m of meshes) {
            m.updateFacetData();
            polycount += m.facetNb;
            m.disableFacetData();
        }
        return polycount;
    }
}