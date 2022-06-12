import { Vector2 } from '@babylonjs/core';
import Block from './Block';
import WorldPolygon, { Edge } from './WorldPolygon'

type BridgeConnection = {
    edge_idx: number;
    edge_pos: number;
    bridge_idx: number;
}

export type DistrictDefinition = {
    vertices: Vector2[];
    center: Vector2;
    spawn: Vector2;
    bridge_connections: BridgeConnection[];
    roads: Edge[];
    curbs: Edge[];
    teleportation_booths: Vector2[];
}

export type BlockGenOptions = {
    minSize: number;
    maxSize: number;
}

export default class District extends WorldPolygon {
    public blocks: Block[];
    public bridge_connections: BridgeConnection[];
    public roads: Edge[];
    public curbs: Edge[];
    public seed: number;
    public build_height_provider: any | undefined;
    public spawn: Vector2;
    public teleportation_booths: Vector2[];
    readonly allow_rotation: boolean;
    readonly block_gen_opts: BlockGenOptions;

    constructor(center: Vector2, vertices: Vector2[], seed: number, allow_rotation: boolean = false, block_gen_opts?: BlockGenOptions) {
        super(center, vertices);
        this.blocks = [];
        this.roads = [];
        this.curbs = [];
        this.bridge_connections = [];
        this.seed = seed;
        this.spawn = new Vector2();
        this.teleportation_booths = [];
        this.allow_rotation = allow_rotation;

        if (block_gen_opts)
            this.block_gen_opts = block_gen_opts;
        else
            this.block_gen_opts = { minSize: 30, maxSize: 45 };
    }

    public generateBlocks() {
        throw new Error("Not implemented");
    }

    public addBridgeConnection(conn: BridgeConnection) {
        this.bridge_connections.push(conn);
    }

    public serialise(): DistrictDefinition {
        return { center: this.center, spawn: this.spawn, vertices: this.vertices, bridge_connections: this.bridge_connections, roads: this.roads, curbs: this.curbs, teleportation_booths: this.teleportation_booths };
    }
}