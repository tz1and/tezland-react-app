import { Vector2 } from '@babylonjs/core';
import Block from './Block';
import WorldPolygon from './WorldPolygon'


export default class District extends WorldPolygon {
    public blocks: Block[];

    constructor(center: Vector2, vertices: Vector2[]) {
        super(center, vertices);
        this.blocks = [];
    }

    public generateBlocks() {
        throw new Error("Not implemented");
    }
}