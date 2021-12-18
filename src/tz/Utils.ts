import { Axis, Mesh, Ray, Vector3 } from "@babylonjs/core";

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
    // @ts-ignore
    var pickInfo = ray.intersectsMesh(mesh);
    while (pickInfo.hit) {
        hitCount++;
        pickInfo.pickedPoint!.addToRef(direction.scale(0.00000001), refPoint);
        ray.origin = refPoint;
        // @ts-ignore
        pickInfo = ray.intersectsMesh(mesh);
    }   
    if((hitCount % 2) === 1) {
        pointFound = true;
    }
    
    return pointFound;
}

export const toHexString = (bytes: Uint8Array) => bytes.reduce((str: String, byte: Number) => str + byte.toString(16).padStart(2, '0'), '');