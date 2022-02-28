import { Vector2 } from '@babylonjs/core';
import Block from './Block';
import WorldPolygon from './WorldPolygon'

type BridgeConnection = {
    edge_idx: number;
    edge_pos: number;
    bridge_idx: number;
}

export type DistrictDefinition = {
    vertices: Vector2[];
    center: Vector2;
    bridge_connections: BridgeConnection[];
    // TODO: roads, curbs
    //roads: Edge
}

export default class District extends WorldPolygon {
    public blocks: Block[];
    public bridge_connections: BridgeConnection[];

    constructor(center: Vector2, vertices: Vector2[]) {
        super(center, vertices);
        this.blocks = [];
        this.bridge_connections = [];
    }

    public generateBlocks() {
        throw new Error("Not implemented");
    }

    public addBridgeConnection(conn: BridgeConnection) {
        this.bridge_connections.push(conn);
    }

    public serialise(): DistrictDefinition {
        return { center: this.center, vertices: this.vertices, bridge_connections: this.bridge_connections };
    }
}