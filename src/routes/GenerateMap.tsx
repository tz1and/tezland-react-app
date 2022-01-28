import React, { createRef } from "react";
import { Svg } from "@svgdotjs/svg.js";
import { Voronoi, BoundingBox, Site, Diagram } from 'voronoijs';
import { Angle, Vector2 } from '@babylonjs/core'
import Conf from "../Config";
import { OpKind } from "@taquito/taquito";
import { char2Bytes } from '@taquito/utils'
import { createPlaceTokenMetadata, upload_places } from "../ipfs/ipfs";
import Prando from 'prando';
import { intersection, Polygon, Ring } from 'polygon-clipping';
import { Matrix2D } from "@babylonjs/gui";
import { signedArea, sleep } from "../utils/Utils";
import TezosWalletContext from "../components/TezosWalletContext";


class Land {
    public center: Vector2;
    public points: Vector2[];
    public dontSplit: boolean;

    constructor() {
        this.center = new Vector2();
        this.points = [];
        this.dontSplit = false;
    }

    isValid(): boolean {
        if(this.points.length < 3) return false;
        if(this.area() < 18) return false;

        for (const p of this.points)
            if (!isFinite(p.x) || !isFinite(p.y)) return false;

        return true;
    }

    area(): number {
        const verts = this.pointsToArray();
        var polygonArea = Math.abs(signedArea(verts, 0, verts.length, 2));
        return polygonArea;
    }

    pointsToArray(): number[] {
        const arr: number[] = []

        this.points.forEach((p) => {
            arr.push(p.x, p.y);
        })

        return arr;
    }

    pointsToArraySvg(): number[] {
        const arr: number[] = []

        this.points.forEach((p) => {
            arr.push(-p.x, p.y);
        })

        return arr;
    }

    pointsToPolygon(): Polygon {
        const arr: Ring = []

        this.points.forEach((p) => {
            arr.push([p.x, p.y]);
        })

        //arr.push([this.points[0].x, this.points[0].y]);

        return [arr];
    }

    centroid(): Vector2 {
        const centroid = new Vector2();
        this.points.forEach((p) => {
            centroid.addInPlace(p);
        })
        centroid.divideInPlace(new Vector2(this.points.length, this.points.length));

        return centroid;
    }

    pointsRelative(rel: Vector2): Vector2[] {
        const relpoints: Vector2[] = [];

        this.points.forEach((p) => {
            relpoints.push(p.subtract(rel));
        });

        return relpoints;
    }

    naiveShrink(s: number) {
        const newpoints: Vector2[] = [];

        const centroid = this.centroid();
        console.log(centroid);

        this.points.forEach((p) => {
            const fromCenter = p.subtract(centroid)

            const newLen = fromCenter.length() - s;
            newpoints.push(fromCenter.normalize().scale(newLen).add(centroid))
        })

        this.points = newpoints;
    }

    private preprocess(spacing: number) {
        // preprocess the points to remove any points closer together than spacing
        const preprocess_points: Vector2[] = [];
        for(let i = 0; i < this.points.length; ++i) {
            const nextPoint = this.points[(i+1) % this.points.length]
            const vec = this.points[i].subtract(nextPoint)

            // If this and the next point aren't too close together, add this point.
            if(vec.length() > spacing) preprocess_points.push(this.points[i]);
            // If they are, set the next point to the centroid of this and the next point.
            else nextPoint.addInPlace(this.points[i]).divideInPlace(new Vector2(2, 2));
        }

        this.points = preprocess_points;
    }

    straightSkeleton(spacing: number) {

        this.preprocess(spacing * 1.2);

        // http://stackoverflow.com/a/11970006/796832
        // Accompanying Fiddle: http://jsfiddle.net/vqKvM/35/

        const resulting_path: Vector2[] = [];
        const N = this.points.length;
        var mi, mi1, li, li1, ri, ri1, si, si1, Xi1, Yi1;
        for (var i = 0; i < N; i++) {
            mi = (this.points[(i + 1) % N].y - this.points[i].y) / (this.points[(i + 1) % N].x - this.points[i].x);
            mi1 = (this.points[(i + 2) % N].y - this.points[(i + 1) % N].y) / (this.points[(i + 2) % N].x - this.points[(i + 1) % N].x);
            li = Math.sqrt((this.points[(i + 1) % N].x - this.points[i].x) * (this.points[(i + 1) % N].x - this.points[i].x) + (this.points[(i + 1) % N].y - this.points[i].y) * (this.points[(i + 1) % N].y - this.points[i].y));
            li1 = Math.sqrt((this.points[(i + 2) % N].x - this.points[(i + 1) % N].x) * (this.points[(i + 2) % N].x - this.points[(i + 1) % N].x) + (this.points[(i + 2) % N].y - this.points[(i + 1) % N].y) * (this.points[(i + 2) % N].y - this.points[(i + 1) % N].y));
            ri = this.points[i].x + spacing * (this.points[(i + 1) % N].y - this.points[i].y) / li;
            ri1 = this.points[(i + 1) % N].x + spacing * (this.points[(i + 2) % N].y - this.points[(i + 1) % N].y) / li1;
            si = this.points[i].y - spacing * (this.points[(i + 1) % N].x - this.points[i].x) / li;
            si1 = this.points[(i + 1) % N].y - spacing * (this.points[(i + 2) % N].x - this.points[(i + 1) % N].x) / li1;
            Xi1 = (mi1 * ri1 - mi * ri + si - si1) / (mi1 - mi);
            Yi1 = (mi * mi1 * (ri1 - ri) + mi1 * si - mi * si1) / (mi1 - mi);
            // Correction for vertical lines
            if (this.points[(i + 1) % N].x - this.points[i % N].x === 0) {
                Xi1 = this.points[(i + 1) % N].x + spacing * (this.points[(i + 1) % N].y - this.points[i % N].y) / Math.abs(this.points[(i + 1) % N].y - this.points[i % N].y);
                Yi1 = mi1 * Xi1 - mi1 * ri1 + si1;
            }
            if (this.points[(i + 2) % N].x - this.points[(i + 1) % N].x === 0) {
                Xi1 = this.points[(i + 2) % N].x + spacing * (this.points[(i + 2) % N].y - this.points[(i + 1) % N].y) / Math.abs(this.points[(i + 2) % N].y - this.points[(i + 1) % N].y);
                Yi1 = mi * Xi1 - mi * ri + si;
            }

            //console.log("mi:", mi, "mi1:", mi1, "li:", li, "li1:", li1);
            //console.log("ri:", ri, "ri1:", ri1, "si:", si, "si1:", si1, "Xi1:", Xi1, "Yi1:", Yi1);

            resulting_path.push(new Vector2(Xi1, Yi1));
        }

        this.points = resulting_path;
    }
}

const translateAndRotate = (x: number, y: number, r: number): Matrix2D => {
    const m_t = Matrix2D.Identity();
    Matrix2D.TranslationToRef(x, y, m_t);
    const m_r = Matrix2D.Identity();
    Matrix2D.RotationToRef(Angle.FromDegrees(r).radians(), m_r);
    const m = Matrix2D.Identity();
    m_r.multiplyToRef(m_t, m);
    return m;
}

/*const rotateAndTranslate = (x: number, y: number, r: number): Matrix2D => {
    const m_t = Matrix2D.Identity();
    Matrix2D.TranslationToRef(x, y, m_t);
    const m_r = Matrix2D.Identity();
    Matrix2D.RotationToRef(Angle.FromDegrees(r).radians(), m_r);
    const m = Matrix2D.Identity();
    m_t.multiplyToRef(m_r, m);
    return m;
}*/

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class Rectangle {
    public width: number;
    public height: number;

    public pos: Vector2;
    public angle: number;
    //public transform: Matrix2D;

    constructor(width: number = 100, height: number = 100, pos: Vector2, angle: number) {
        this.width = width;
        this.height = height;
        this.pos = pos;
        this.angle = angle;
    }

    subdivide(x: number, y: number): Rectangle[] {
        const arr: Rectangle[] = [];

        const transform = translateAndRotate(this.pos.x, this.pos.y, this.angle);

        const xoff = this.width/x;
        const yoff = this.height/y;

        const tx = (-this.width + xoff) / 2;
        const ty = (-this.height + yoff) / 2;

        for (let i = 0; i < x; ++i) {
            for (let j = 0; j < y; ++j) {
                const pos = new Vector2();
                transform.transformCoordinates(xoff * i + tx, yoff * j + ty, pos);
                arr.push(new Rectangle(this.width / x, this.height / y, pos, this.angle))
            }
        }

        return arr;
    }

    points(): Vector2[] {
        const arr: Vector2[] = [];

        const transform = translateAndRotate(this.pos.x, this.pos.y, this.angle);
        
        arr.push(new Vector2(/*this.pos.x*/ - this.width / 2, /*this.pos.y*/ - this.height / 2));
        arr.push(new Vector2(/*this.pos.x*/ + this.width / 2, /*this.pos.y*/ - this.height / 2));
        arr.push(new Vector2(/*this.pos.x*/ + this.width / 2, /*this.pos.y*/ + this.height / 2));
        arr.push(new Vector2(/*this.pos.x*/ - this.width / 2, /*this.pos.y*/ + this.height / 2));

        for(const p of arr) {
            transform.transformCoordinates(p.x, p.y, p);
        }

        return arr;
    }

    pointsToPolygon(): Polygon {
        const arr: Ring = []

        //const points = this.points();
        for (const p of this.points()) {
            arr.push([p.x, p.y]);
        };
        //arr.push([this.points[0].x, this.points[0].y]);

        return [arr];
    }

    pointsToArray(): number[] {
        const arr: number[] = [];

        for (const p of this.points()) {
            arr.push(p.x, p.y);
        }

        return arr;
    }
}

class ExclusionZone {
    public center: Vector2;
    public radius: number;

    constructor(center: Vector2, radius: number) {
        this.center = center;
        this.radius = radius;
    }
}

type GenerateMapState = {
    svg?: string;
}

type GenerateMapProps = {

}

export default class GenerateMap extends React.Component<GenerateMapProps, GenerateMapState> {
    static contextType = TezosWalletContext;
    context!: React.ContextType<typeof TezosWalletContext>;
    
    constructor(props: GenerateMapProps) {
        super(props);
        this.state = {

        };
    }

    private svgRef = createRef<SVGSVGElement>();

    private downloadFile = () => {
        if(!this.state.svg) return;

        // create blob from data
        const data = new Blob([this.state.svg], { type: 'image/svg+xml' });
        const downloadLink = window.URL.createObjectURL(data);

        // create download file link
        const link = document.createElement('a');
        link.href = downloadLink;
        link.setAttribute(
            'download',
            `map.svg`,
        );

        // Append to html link element and cick it
        document.body.appendChild(link);
        link.click();

        // Clean up and remove the link
        document.body.removeChild(link);
    }

    private generateCircle = (sites: Site[], exclusion: ExclusionZone[],
        pos: Vector2, radius: number, rotate: number, points: number) => {
        sites.push({ id: sites.length, x: pos.x, y: pos.y});

        const siteLen = sites.length;

        // generate circle
        for(let i = 0; i < points; i++) {
            const rad = Math.PI * 2 / points * i
            
            const x = pos.x + radius * Math.cos(rad + rotate);
            const y = pos.y + radius * Math.sin(rad + rotate);

            sites.push({id: i + siteLen, x: x, y: y})
        }

        exclusion.push(new ExclusionZone(pos, radius * 1.5));
    }

    private generateRandomSites = (sites: Site[], exclusion: ExclusionZone[], points: number, seed: number) => {
        const prando = new Prando(seed);

        for(let i = 0; i < points; i++) {
            const pos = new Vector2(prando.next(-500, 500), prando.next(-500, 500));

            var excl = false;
            for (let j = 0; j < exclusion.length; ++j) {
                if(pos.subtract(exclusion[j].center).length() < exclusion[j].radius) {
                    excl = true;
                    break;
                }
            };

            if(!excl) sites.push({id: sites.length, x: pos.x, y: pos.y});
        }
    }

    private clipAgainst = (land: Land, poly: Polygon): Land[] => {

        // TEMP: skip clip
        /*const nl = new Land();
        // need to get points in reverse
        for(let i = poly[0].length-1; i >= 0 ; --i) {
            const p = poly[0][i];
            nl.points.push(new Vector2(p[0], p[1]));
        }
        nl.center = nl.centroid();
        return nl;*/

        try{
            const res = intersection(land.pointsToPolygon(), poly)

            const landArr: Land[] = [];
            for (const resP of res) {
            //if(res.length === 1) {
                const nl = new Land();
                // need to get points in reverse
                for(let i = resP[0].length-1; i > 0 ; --i) {
                    const p = resP[0][i];
                    nl.points.push(new Vector2(p[0], p[1]));
                }
                nl.center = nl.centroid();
                landArr.push(nl);
            }
            return landArr;
        } catch(e: any) { console.log(e); console.log(poly); console.log(land); }

        return [];
    }

    private generateGrid = (land: Land, prando: Prando, draw: Svg): Polygon[] => {
        // TODO: New code using subdivided Rectangle
         // compute bounds
        /*let min = new Vector2(Infinity, Infinity);
        let max = new Vector2(-Infinity, -Infinity);
        for (const p of land.points) {
            min = Vector2.Minimize(p, min);
            max = Vector2.Maximize(p, max);
        }
        const safeEps = 0.001;
        min.subtractInPlace(new Vector2(safeEps, safeEps));
        max.addInPlace(new Vector2(safeEps, safeEps));

        const extent = max.subtract(min);
        const max_extent = Math.max(extent.x, extent.y);
        const gridSize = new Vector2(Math.ceil(max_extent / prando.next(30, 40)), Math.ceil(max_extent / prando.next(30, 40)));

        let rect = new Rectangle(max_extent * 1, max_extent * 1, min.add(extent.divide(new Vector2(2,2))), prando.nextInt(0, 8) * 45);
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
        for (const p of land.points) {
            min = Vector2.Minimize(p, min);
            max = Vector2.Maximize(p, max);
        }
        const safeEps = 0.001;
        min.subtractInPlace(new Vector2(safeEps, safeEps));
        max.addInPlace(new Vector2(safeEps, safeEps));

        const extent = max.subtract(min);
        const gridSize = new Vector2(Math.ceil(extent.x / prando.next(25, 35)), Math.ceil(extent.y / prando.next(25, 35)));
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private mintPlaces = async (land: Land[]) => {
        const minterWallet = await this.context.tezosToolkit().wallet.at(Conf.minter_contract);
        const walletphk = this.context.walletPHK();

        const places = []

        for(const curr of land) {
            if(!curr.isValid()) continue;

            const centroid = curr.centroid();
            const pointsrel: number[][] = [];
            curr.pointsRelative(centroid).forEach((p) => {
                pointsrel.push([p.x, 0, p.y])
            });

            places.push(createPlaceTokenMetadata({
                name: `Place #${places.length}`,
                description: `${curr.area().toFixed(2)} \u33A1`,
                minter: walletphk,
                centerCoordinates: [centroid.x, 0, centroid.y],
                borderCoordinates: pointsrel,
                buildHeight: 10,
                placeType: "exterior"
            }));
        };

        console.log("valid places", places.length);

        return; // TEMP

        // Upload all places metadata
        // eslint-disable-next-line no-unreachable
        const place_meta_files = await upload_places(places);

        console.log("upload places done");

        // Mint places
        let batch = this.context.tezosToolkit().wallet.batch();
        let batch_size = 0;

        for(const meta of place_meta_files) {
            console.log(meta);

            batch.with([
                {
                    kind: OpKind.TRANSACTION,
                    ...minterWallet.methodsObject.mint_Place({
                        address: walletphk,
                        metadata: char2Bytes(meta)
                    }).toTransferParams()
                }
            ]);

            batch_size++;

            if(batch_size >= 150) {
                console.log("batch limit reached, sending batch");

                const batch_op = await batch.send();
                await batch_op.confirmation();

                // TODO: figure out how long to wait between operations...
                console.log("sleep a little");
                await sleep(10000);
                console.log("done sleeping, preparing next batch");

                batch = this.context.tezosToolkit().wallet.batch();
                batch_size = 0;
            }
        }

        if(batch_size > 0) {
            const batch_op = await batch.send();
            await batch_op.confirmation();
        }
    }

    // Similar to componentDidMount and componentDidUpdate:
    componentDidMount() {
        const dim = 1000;
        const fillColor = '#d6f0ff';
        const strokeColor = '#3d8dba';

        // create canvas
        const draw = new Svg(this.svgRef.current!).size(dim, dim).viewbox(-dim/2, -dim/2, dim, dim)

        draw.clear();

        const voronoi = new Voronoi();
        const bbox: BoundingBox = {xl: -500, xr: 500, yt: -500, yb: 500}; // xl is x-left, xr is x-right, yt is y-top, and yb is y-bottom
        const sites: Site[] = [];
        const exclusion: ExclusionZone[] = [];

        const noSplit: Vector2[] = [];

        // begin old
        /*generateCircle(sites, exclusion, new Vector2(0, 0), 40, 0, 8);

        generateCircle(sites, exclusion, new Vector2(250, -375), 50, 0, 6);

        generateCircle(sites, exclusion, new Vector2(-412, -175), 75, 0, 5);

        for (let i = 0; i < 4; ++i) {
            generateCircle(sites, exclusion, new Vector2(395 - 65 * i, 275), 65, Angle.FromDegrees(0).radians(), 4);
        }

        for (let i = 0; i < 4; ++i) {
            generateCircle(sites, exclusion, new Vector2(395 - 65 * i, 405), 65, Angle.FromDegrees(0).radians(), 4);
        }

        for (let i = 0; i < 4; ++i) {
            generateCircle(sites, exclusion, new Vector2(-395 + 65 * i, 285), 65, Angle.FromDegrees(0).radians(), 4);
        }

        for (let i = 0; i < 4; ++i) {
            generateCircle(sites, exclusion, new Vector2(-395 + 65 * i, 415), 65, Angle.FromDegrees(0).radians(), 4);
        }*/
        // end old

        // generate central circle
        this.generateCircle(sites, exclusion, new Vector2(0, 0), 40, 0, 8);

        for(const s of sites) {
            noSplit.push(new Vector2(s.x, s.y));
        }

        this.generateCircle(sites, exclusion, new Vector2(0, 0), 80, 0, 8);

        // generate grid blocks
        for (let i = 0; i < 4; ++i) {
            this.generateCircle(sites, exclusion, new Vector2(395 - 65 * i, 275), 65, Angle.FromDegrees(45).radians(), 4);
        }

        noSplit.push(new Vector2(395 - 65, 275));

        for (let i = 0; i < 4; ++i) {
            this.generateCircle(sites, exclusion, new Vector2(395 - 65 * i, 405), 65, Angle.FromDegrees(45).radians(), 4);
        }

        noSplit.push(new Vector2(395 - 65, 405));

        for (let i = 0; i < 4; ++i) {
            this.generateCircle(sites, exclusion, new Vector2(-395 + 65 * i, 275), 65, Angle.FromDegrees(0).radians(), 4);
        }

        noSplit.push(new Vector2(-395 + 65, 275));

        for (let i = 0; i < 4; ++i) {
            this.generateCircle(sites, exclusion, new Vector2(-395 + 65 * i, 405), 65, Angle.FromDegrees(0).radians(), 4);
        }

        noSplit.push(new Vector2(-395 + 65, 405));

        for (let i = 0; i < 4; ++i) {
            this.generateCircle(sites, exclusion, new Vector2(395 - 65 * i, -275), 65, Angle.FromDegrees(0).radians(), 4);
        }

        noSplit.push(new Vector2(395 - 65, -275));

        for (let i = 0; i < 4; ++i) {
            this.generateCircle(sites, exclusion, new Vector2(395 - 65 * i, -405), 65, Angle.FromDegrees(0).radians(), 4);
        }

        noSplit.push(new Vector2(395 - 65, -405));

        for (let i = 0; i < 4; ++i) {
            this.generateCircle(sites, exclusion, new Vector2(-395 + 65 * i, -275), 65, Angle.FromDegrees(45).radians(), 4);
        }

        noSplit.push(new Vector2(-395 + 65, -275));

        for (let i = 0; i < 4; ++i) {
            this.generateCircle(sites, exclusion, new Vector2(-395 + 65 * i, -405), 65, Angle.FromDegrees(45).radians(), 4);
        }

        noSplit.push(new Vector2(-395 + 65, -405));

        // generate other circles
        this.generateCircle(sites, exclusion, new Vector2(0, 275 + 65), 80, 0, 5);
        this.generateCircle(sites, exclusion, new Vector2(0, -275 - 65), 80, Angle.FromDegrees(180).radians(), 5);

        noSplit.push(new Vector2(0, 275 + 65));
        noSplit.push(new Vector2(0, -275 - 65));

        this.generateCircle(sites, exclusion, new Vector2(-275 - 65, 0), 90, 0, 6);
        this.generateCircle(sites, exclusion, new Vector2(275 + 65, 0), 90, Angle.FromDegrees(90).radians(), 6);

        noSplit.push(new Vector2(275 + 65, 0));
        noSplit.push(new Vector2(-275 - 65, 0));

        this.generateRandomSites(sites, exclusion, 200, 663);
 
        const diagram: Diagram = voronoi.compute(sites, bbox);

        var landArray: Land[] = []

        for(const cell of diagram.cells) {
            const land = new Land();
            // TODO: probably want to preserve site ID to be able to exclude a few sites from tesselation.
            //land.id = cell.site.id;
            land.center.set(cell.site.x, cell.site.y)

            for(const halfedge of cell.halfedges) {
                if(halfedge.edge.rSite === cell.site)
                    land.points.push(new Vector2(halfedge.edge.va.x, halfedge.edge.va.y));
                else
                    land.points.push(new Vector2(halfedge.edge.vb.x, halfedge.edge.vb.y));
            }

            for (const p of noSplit) {
                if(land.center.equalsWithEpsilon(p)) land.dontSplit = true;
            }

            landArray.push(land);
        }

        // Sort original sites by distance to center
        const center = new Vector2();
        landArray = landArray.sort((a, b) => a.center.subtract(center).length() - b.center.subtract(center).length());

        for(const land of landArray) {
            land.straightSkeleton(3.5);
        }

        // TODO: tesselate large cells into grids.
        const prando = new Prando(1234);
        const clippedLand: Land[] = []

        let land_limit_counter = 0;
        let land_limit = Infinity;
        for(const land of landArray) {
            if(land_limit_counter > land_limit) break;

            if(land.dontSplit) {
                land.straightSkeleton(3);
                clippedLand.push(land);
                console.log("didn't split")
                continue;
            }

            //draw.polygon(land.pointsToArray()).fill('red').stroke('red').attr({'stroke-width': 0.5});

            const grid = this.generateGrid(land, prando, draw);

            for (const poly of grid) {
                const newland = this.clipAgainst(land, poly);

                // shrink then clip again to get rid of some of the weird ones
                newland.forEach((l) => {
                    l.straightSkeleton(3);
                    if(l.isValid()) {
                        const properLand = this.clipAgainst(l, poly);
                        clippedLand.push(...properLand);
                    }
                });
            }

            land_limit_counter++;
        }

        // TODO: figure out which way to flip the map...
        for(const land of clippedLand) {
            if(land.isValid()) {
                draw.polygon(land.pointsToArray()).fill(fillColor).stroke(strokeColor).attr({'stroke-width': 0.5});
                const centroid = land.centroid();
                draw.circle(1).stroke(strokeColor).fill(strokeColor).move(centroid.x - 0.5, centroid.y - 0.5)
                //draw.circle(1).stroke('blue').fill('blue').move(land.center.x - 0.5, land.center.y - 0.5)
            }
        }

        /*for(const land of landArray) {
            draw.polygon(land.pointsToArray()).fill('none').stroke('red');
        }*/

        console.log("Number of places (incl invalid): ", clippedLand.length);
        this.mintPlaces(clippedLand);

        this.setState({svg: draw.svg()});
    }

    render(): React.ReactNode {
        return (
            <main className="container">
                <button className="btn btn-primary" onClick={() => this.downloadFile()}>Download SVG</button>
                <svg className="d-block" ref={this.svgRef}></svg>
            </main>
        );
    }
};