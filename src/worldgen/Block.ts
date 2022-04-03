import { Vector2 } from '@babylonjs/core';
import { Matrix2D } from '@babylonjs/gui';
import assert from 'assert';
import { Polygon } from 'polygon-clipping';
import Prando from 'prando';
import { BlockGenOptions } from './District';
import Lot from './Lot';
import Rectangle, { translateAndRotate } from './Rectangle';
import WorldPolygon, { Edge } from './WorldPolygon'


export default class Block extends WorldPolygon {
    public lots: Lot[];
    public dont_split: boolean;
    public allow_rotation: boolean;
    public block_gen_opts: BlockGenOptions;
    
    constructor(center: Vector2, vertices: Vector2[], allow_rotation: boolean, block_gen_opts: BlockGenOptions) {
        super(center, vertices);
        this.lots = [];
        this.dont_split = false;
        this.allow_rotation = allow_rotation;
        this.block_gen_opts = block_gen_opts
    }

    public generateLots(seed: number, build_height_provider: any | undefined) {
        // TODO: tesselate large cells into grids?
        const prando = new Prando(seed);
        
        if(this.dont_split) {
            const lot = new Lot(this.center, this.vertices);
            lot.straightSkeleton(3);
            if (!build_height_provider) lot.buildHeight += prando.next(0, 20);
            else throw new Error("build_height_provider not implemented");
            this.lots.push(lot);
            console.log("didn't split");
            return;
        }

        //draw.polygon(land.pointsToArray()).fill('red').stroke('red').attr({'stroke-width': 0.5});

        const grid = this.generateGrid(prando);

        // TODO: better: shrink, then clip again grid with gaps

        for (const poly of grid) {
            const newland = WorldPolygon.clipAgainst<Block, Lot>(this, poly, Lot);
            // For debugging:
            //const newland = WorldPolygon.clipAgainst<Block, Lot>(new Block(new Vector2(), [new Vector2(1000,1000), new Vector2(-1000,1000), new Vector2(-1000,-1000), new Vector2(1000,-1000)], false), poly, Lot);

            // shrink then clip again to get rid of some of the weird ones
            newland.forEach((l) => {
                l.straightSkeleton(3);
                if(l.isValid()) {
                    const properLand = WorldPolygon.clipAgainst<Lot, Lot>(l, poly, Lot);

                    // Build height is just random for now
                    properLand.forEach((l) => {
                        if (!build_height_provider) l.buildHeight += prando.next(0, 20);
                        else throw new Error("build_height_provider not implemented");
                    })

                    this.lots.push(...properLand);
                }
            });
        }
    }

    private generateGrid(prando: Prando): Polygon[] {
        const safeEps = 0.001;
        // TODO: New code using subdivided Rectangle
        // Find the longest edge (to rotate along)
        let longest_edge_len = -Infinity;
        let longest_edge: Edge | undefined;
        this.edges().forEach((edge) => {
            const len = edge.length();
            if (len > longest_edge_len) {
                longest_edge_len = len;
                longest_edge = edge;
            }
        });

        assert(longest_edge);
        const edge_dir = longest_edge.b.subtract(longest_edge.a).normalize();
        const angle = this.allow_rotation ? Math.atan2(edge_dir.y, edge_dir.x) : 0;

        // compute bounds
        const transform = translateAndRotate(this.center.x, this.center.y, angle);
        const transform_inv = Matrix2D.Identity();
        transform.invertToRef(transform_inv);

        const [min, max] = this.extent(safeEps, transform_inv);
        const extent = max.subtract(min);
        
        const new_center = min.add(extent.divide(new Vector2(2,2)));
        transform.transformCoordinates(new_center.x, new_center.y, new_center);

        const gridSize = new Vector2(
            Math.ceil(extent.x / prando.next(this.block_gen_opts.minSize, this.block_gen_opts.maxSize)),
            Math.ceil(extent.y / prando.next(this.block_gen_opts.minSize, this.block_gen_opts.maxSize)));

        let rect = new Rectangle(extent.x, extent.y, new_center, angle);
        //draw.polygon(rect.pointsToArray()).stroke('red').fill('none');

        const grid: Polygon[] = [];

        for (const s of rect.subdivide(gridSize.x, gridSize.y)) {
            //draw.polygon(s.pointsToArray()).stroke('red').fill('none');

            grid.push(s.pointsToPolygon());
        }

        return grid;
    }
}