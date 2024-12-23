import { Vector2 } from "@babylonjs/core/Maths";
import Prando from "prando";
import { BoundingBox, Diagram, Site, Voronoi } from "voronoijs";
import { DeepEqualsSet } from "../utils/Sets";
import Block from "./Block";
import District, { BlockGenOptions } from "./District";
import WorldPolygon, { Edge } from "./WorldPolygon";


export class ExclusionZone {
    public center: Vector2;
    public radius: number;

    constructor(center: Vector2, radius: number) {
        this.center = center;
        this.radius = radius;
    }
}

export default class VoronoiDistrict extends District {
    public sites: Site[];
    public noSplit: Vector2[];
    public exclusion: ExclusionZone[];
        
    constructor(center: Vector2, vertices: Vector2[], seed: number, allow_rotation: boolean = false, block_gen_opts?: BlockGenOptions) {
        super(center, vertices, seed, allow_rotation, block_gen_opts);

        this.sites = [];
        this.exclusion = [];
        this.noSplit = [];
    }

    public addSite(pos: Vector2, split: boolean, exclusion: boolean, radius: number = 0) {
        this.sites.push({id: this.sites.length, x: pos.x, y: pos.y});

        if(exclusion)
            this.exclusion.push(new ExclusionZone(pos, radius));

        if(!split)
            this.noSplit.push(pos);
    }

    public addCircle(pos: Vector2, radius: number, rotate: number, points: number) {
        this.sites.push({ id: this.sites.length, x: pos.x, y: pos.y});

        const siteLen = this.sites.length;

        // generate circle
        for(let i = 0; i < points; i++) {
            const rad = Math.PI * 2 / points * i
            
            const x = pos.x + radius * Math.cos(rad + rotate);
            const y = pos.y + radius * Math.sin(rad + rotate);

            this.sites.push({id: i + siteLen, x: x, y: y})
        }

        this.exclusion.push(new ExclusionZone(pos, radius * 1.5));
    }

    public addRandomSites(points: number, seed: number) {
        const prando = new Prando(seed);
        const [min, max] = this.extent();

        for(let i = 0; i < points; i++) {
            const pos = new Vector2(prando.next(min.x, max.x), prando.next(min.y, max.y));

            var excl = false;
            for (let j = 0; j < this.exclusion.length; ++j) {
                if(pos.subtract(this.exclusion[j].center).length() < this.exclusion[j].radius) {
                    excl = true;
                    break;
                }
            };

            if(!excl) this.sites.push({id: this.sites.length, x: pos.x, y: pos.y});
        }
    }

    public override generateBlocks() {
        const voronoi = new Voronoi();

        // Vornonoi bounds need some margin.
        const bounds_margin = 25;
        const [min, max] = this.extent(bounds_margin);

        const bbox: BoundingBox = {xl: min.x, xr: max.x, yt: min.y, yb: max.y}; // xl is x-left, xr is x-right, yt is y-top, and yb is y-bottom
        const diagram: Diagram = voronoi.compute(this.sites, bbox);

        const unclipped_blocks: Block[] = []
        //const unclipped_cells: Block[] = [] // TODO: needs work

        // Generate blocks from cells and shrink them.
        for(const cell of diagram.cells) {
            // TODO: probably want to preserve site ID to be able to exclude a few sites from tesselation.
            //land.id = cell.site.id;
            const center = new Vector2(cell.site.x, cell.site.y);
            const vertices: Vector2[] = [];

            for(const halfedge of cell.halfedges) {
                if(halfedge.edge.rSite === cell.site)
                    vertices.push(new Vector2(halfedge.edge.va.x, halfedge.edge.va.y));
                else
                    vertices.push(new Vector2(halfedge.edge.vb.x, halfedge.edge.vb.y));
            }

            const block = new Block(center, vertices, this.allow_rotation, this.block_gen_opts);

            block.straightSkeleton(3);

            for (const p of this.noSplit) {
                if(block.center.equalsWithEpsilon(p)) block.dont_split = true;
            }

            unclipped_blocks.push(block);

            //unclipped_cells.push(new Block(center, vertices));
        }

        // Clip blocks against shrunk district.
        const d_srunk = WorldPolygon.clone(this, VoronoiDistrict);
        d_srunk.straightSkeleton(6);

        unclipped_blocks.forEach((block) => {
            const blocks = WorldPolygon.clipAgainst<District, Block>(d_srunk, block.verticesToPolygon(), Block);
            // TODO: clip agains could call clone? Then we wouldn't have to do this.
            if(block.dont_split) blocks.forEach((b) => { b.dont_split = true; });
            if(block.allow_rotation) blocks.forEach((b) => { b.allow_rotation = true; });
            blocks.forEach((b) => { b.block_gen_opts = block.block_gen_opts; });
            this.blocks.push(...blocks);
        });

        /*const cells: Block[] = []

        unclipped_cells.forEach((block) => {
            const blocks = WorldPolygon.clipAgainst<District, Block>(d_srunk, block.verticesToPolygon(), Block);
            cells.push(...blocks);
        });

        // TODO: roads need unshrunken clipped cells
        const mainRoads: DeepEqualsSet<Edge> = new DeepEqualsSet();
        //let land_limit_counter = 0;
        //const land_limit = Infinity;
        for(const block of cells) {
            block.edges(this.center).forEach(mainRoads.add, mainRoads);
        }
        this.roads = mainRoads.arr;*/

        const mainRoadCurbs: DeepEqualsSet<Edge> = new DeepEqualsSet();
        //land_limit_counter = 0;
        for(const block of this.blocks) {
            block.edges(this.center).forEach(mainRoadCurbs.add, mainRoadCurbs);
        }
        this.curbs = mainRoadCurbs.arr;

        // Sort original sites by distance to center (of this district).
        const center = new Vector2();
        this.blocks = this.blocks.sort((a, b) => a.center.subtract(center).length() - b.center.subtract(center).length());

        const prando = new Prando(this.seed);
        this.blocks.forEach((b) => {
            b.generateLots(prando.nextInt(0, 1000000), this.build_height_provider);
        })
    }
}