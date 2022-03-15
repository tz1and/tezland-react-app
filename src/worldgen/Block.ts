import { Vector2 } from '@babylonjs/core';
import { Polygon } from 'polygon-clipping';
import Prando from 'prando';
import Lot from './Lot';
import WorldPolygon from './WorldPolygon'


export default class Block extends WorldPolygon {
    public lots: Lot[];
    public dont_split: boolean;
    
    constructor(center: Vector2, vertices: Vector2[]) {
        super(center, vertices);
        this.lots = [];
        this.dont_split = false;
    }

    public generateLots(seed: number) {
        // TODO: tesselate large cells into grids?
        const prando = new Prando(seed);
        
        if(this.dont_split) {
            const lot = new Lot(this.center, this.vertices);
            lot.straightSkeleton(3);
            lot.buildHeight += prando.next(0, 20);
            this.lots.push(lot);
            console.log("didn't split");
            return;
        }

        //draw.polygon(land.pointsToArray()).fill('red').stroke('red').attr({'stroke-width': 0.5});

        const grid = this.generateGrid(prando);

        // TODO: better: shrink, then clip again grid with gaps

        for (const poly of grid) {
            const newland = WorldPolygon.clipAgainst<Block, Lot>(this, poly, Lot);

            // shrink then clip again to get rid of some of the weird ones
            newland.forEach((l) => {
                l.straightSkeleton(3);
                if(l.isValid()) {
                    const properLand = WorldPolygon.clipAgainst<Lot, Lot>(l, poly, Lot);

                    // Build height is just random for now
                    properLand.forEach((l) => {
                        l.buildHeight += prando.next(0, 20);
                    })

                    this.lots.push(...properLand);
                }
            });
        }
    }

    private generateGrid(prando: Prando): Polygon[] {
        // TODO: New code using subdivided Rectangle
         // compute bounds
        /*let min = new Vector2(Infinity, Infinity);
        let max = new Vector2(-Infinity, -Infinity);
        for (const p of this.vertices) {
            min = Vector2.Minimize(p, min);
            max = Vector2.Maximize(p, max);
        }
        const safeEps = 0.001;
        min.subtractInPlace(new Vector2(safeEps, safeEps));
        max.addInPlace(new Vector2(safeEps, safeEps));

        const extent = max.subtract(min);
        const max_extent = Math.max(extent.x, extent.y);
        const gridSize = new Vector2(Math.ceil(max_extent / prando.next(30, 40)), Math.ceil(max_extent / prando.next(30, 40)));

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
        const angle = Vector2.Dot(new Vector2(1,0), longest_edge.b.subtract(longest_edge.a))

        let rect = new Rectangle(max_extent * 1, max_extent * 1, min.add(extent.divide(new Vector2(2,2))), 0);
        //draw.polygon(rect.pointsToArray()).stroke('red').fill('none');

        const grid: Polygon[] = [];

        for (const s of rect.subdivide(gridSize.x, gridSize.x)) {
            //draw.polygon(s.pointsToArray()).stroke('red').fill('none');

            grid.push(s.pointsToPolygon());
        }

        return grid;*/

        // OLD CODE. TBH: old code was better
        // compute bounds
        let min = new Vector2(Infinity, Infinity);
        let max = new Vector2(-Infinity, -Infinity);
        for (const p of this.vertices) {
            min = Vector2.Minimize(p, min);
            max = Vector2.Maximize(p, max);
        }
        const safeEps = 0.001;
        min.subtractInPlace(new Vector2(safeEps, safeEps));
        max.addInPlace(new Vector2(safeEps, safeEps));

        const extent = max.subtract(min);
        const gridSize = new Vector2(Math.ceil(extent.x / prando.next(30, 40)), Math.ceil(extent.y / prando.next(30, 40)));
        const spacing = new Vector2(extent.x / gridSize.x, extent.y / gridSize.y);
        
        const grid: Polygon[] = [];

        for (let i = 0; i < gridSize.x; ++i) {
            for (let j = 0; j < gridSize.y; ++j) {
                const pos = new Vector2(min.x + spacing.x * i + spacing.x / 2, min.y + spacing.y * j + spacing.y / 2);

                const poly: Polygon = [[
                    [spacing.x / 2 + pos.x, spacing.y / 2 + pos.y],
                    [-spacing.x / 2 + pos.x, spacing.y / 2 + pos.y],
                    [-spacing.x / 2 + pos.x, -spacing.y / 2 + pos.y],
                    [spacing.x / 2 + pos.x, -spacing.y / 2 + pos.y],
                    //[spacing.x / 2 + pos.x, spacing.y / 2 + pos.y]
                ]];

                grid.push(poly);
            }
        }

        return grid;
    }
}