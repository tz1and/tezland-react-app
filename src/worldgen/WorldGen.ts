import { Vector2 } from "@babylonjs/core";
import District, { DistrictDefinition } from "./District";

// TODO: add bridgeConnectionPoints to District. Index into bridges.
export class Bridge {
    readonly district0: District;
    readonly edge0idx: number;
    readonly edge0pos: number;

    readonly district1: District;
    readonly edge1idx: number;
    readonly edge1pos: number;

    readonly bridge_path: Vector2[];

    constructor(district0: District, edge0idx: number, edge0pos: number,
        district1: District, edge1idx: number, edge1pos: number) {

        this.district0 = district0;
        this.edge0idx = edge0idx;
        this.edge0pos = edge0pos;

        this.district1 = district1;
        this.edge1idx = edge1idx;
        this.edge1pos = edge1pos;

        // Bridge Path.
        const edge0 = this.district0.edges(this.district0.center)[this.edge0idx];
        const edge1 = this.district1.edges(this.district1.center)[this.edge1idx];

        this.bridge_path = [
            Vector2.Lerp(edge0.a, edge0.b, this.edge0pos),
            Vector2.Lerp(edge1.a, edge1.b, this.edge1pos)
        ];
    }
}

type BridgeDefinition = {
    bridge_path: Vector2[];
}

export class WorldDefinition {
    districts: DistrictDefinition[];
    bridges: BridgeDefinition[];

    constructor() {
        this.districts = [];
        this.bridges = [];
    }
}

/**
 * The world is made up of Districts (there can be different kinds, initially VoronoiDistrict).
 * Districts subdivide into Blocks and Blocks into Lots.
 * 
 * Everything that is not "Land" is water. Spaces between Districts are rivers, lakes, etc.
 */

export default class WorldGen {
    public districts: District[];
    public bridges: Bridge[];
    //public connected_districts: [District, District][];

    constructor() {
        this.districts = [];
        this.bridges = [];
    }

    public addDistrict(district: District) {
        this.districts.push(district);
    }

    public addBridge(bridge: Bridge) {
        this.bridges.push(bridge);

        bridge.district0.addBridgeConnection({
            edge_idx: bridge.edge0idx,
            edge_pos: bridge.edge0pos,
            bridge_idx: this.bridges.length - 1
        });

        bridge.district1.addBridgeConnection({
            edge_idx: bridge.edge1idx,
            edge_pos: bridge.edge1pos,
            bridge_idx: this.bridges.length - 1
        });
    }

    public serialise(): WorldDefinition {
        const world_def: WorldDefinition = {
            districts: [],
            bridges: []
        };

        for (const district of this.districts) {
            world_def.districts.push(district.serialise());
        }

        for (const bridge of this.bridges) {
            world_def.bridges.push({ bridge_path: bridge.bridge_path });
        }

        return world_def;
    }

    /*private generateBridges() {
        this.connected_districts.forEach((c) => {
            // Get edges
            const edges0 = c[0].edges(c[0].center);
            const edges1 = c[1].edges(c[1].center);

            let closest = Infinity;
            let bridged: [number, number] | undefined = undefined;
            // Find closes edge
            for (let i = 0; i < edges0.length; ++i) {
                for (let j = 0; j < edges1.length; ++j) {
                    // Get centerpoint of edge i.
                    // And calculate closes point on edge j.
                    const dist = Vector2.DistanceOfPointFromSegment(edges0[i].centerPoint(), edges1[j].a, edges1[j].b);

                    // If closer than last closest, record pair.
                    if (dist < closest) {
                        closest = dist;
                        bridged = [i, j];
                    }
                }
            }

            if (bridged) {
                console.log("Bridging districts on ", bridged, " at distance ", closest);
                const e0 = edges0[bridged[0]];
                const e0len = e0.a.subtract(e0.b).length();
                
                const e1 = edges1[bridged[1]];

                console.log(Vector2.Lerp(e0.a, e0.b, 0.5))
            }
        });
    }*/

    public generateWorld() {
        this.districts.forEach((d) => {
            d.generateBlocks();
        })

        //this.generateBridges();
    }
}