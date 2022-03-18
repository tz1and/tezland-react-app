import { Vector2 } from '@babylonjs/core';
import WorldPolygon from './WorldPolygon'


export default class Lot extends WorldPolygon {
    public buildHeight: number;
    constructor(center: Vector2, vertices: Vector2[]) {
        super(center, vertices);
        this.buildHeight = 10;
    }

    // TODO: add area arg and put in WorldPolygon?
    isValid(): boolean {
        if(this.vertices.length < 3) return false;
        if(this.area() < 10) return false;

        for (const p of this.vertices)
            if (!isFinite(p.x) || !isFinite(p.y)) return false;

        return true;
    }
}