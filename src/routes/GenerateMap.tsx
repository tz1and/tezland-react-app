import { createRef, useEffect } from "react";
import { Svg } from "@svgdotjs/svg.js";
import { Voronoi, BoundingBox, Site, Diagram } from 'voronoijs';
import { Angle, Vector2 } from '@babylonjs/core'
import Conf from "../Config";
import Contracts from "../tz/Contracts";
import { OpKind } from "@taquito/taquito";
import { char2Bytes } from '@taquito/utils'
import { createPlaceTokenMetadata, upload_places } from "../ipfs/ipfs";
import Prando from 'prando';
import { intersection, Polygon, Ring } from 'polygon-clipping'; // TODO
const sleep = (milliseconds: number) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

type GenerateMapState = {
    svg?: string;
}

class Land {
    public center: Vector2;
    public points: Vector2[];

    constructor() {
        this.center = new Vector2();
        this.points = [];
    }

    pointsToArray(): number[] {
        const arr: number[] = []

        this.points.forEach((p) => {
            arr.push(p.x, p.y);
        })

        return arr;
    }

    pointsTo2dArray(): Polygon {
        const arr: Ring = []

        this.points.forEach((p) => {
            arr.push([p.x, p.y]);
        })

        arr.push([this.points[0].x, this.points[0].y]);

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

class ExclusionZone {
    public center: Vector2;
    public radius: number;

    constructor(center: Vector2, radius: number) {
        this.center = center;
        this.radius = radius;
    }
}

export default function GenerateMap() {
    const state: GenerateMapState = { }

    const svgRef = createRef<SVGSVGElement>();

    const downloadFile = () => {
        if(!state.svg) return;

        // create blob from data
        const data = new Blob([state.svg], { type: 'image/svg+xml' });
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

    const generateCircle = (sites: Site[], exclusion: ExclusionZone[],
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

    const generateRandomSites = (sites: Site[], exclusion: ExclusionZone[], points: number, seed: number) => {
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mintPlaces = async (land: Land[]) => {
        const minterWallet = await Contracts.wallet().at(Conf.minter_contract);
        const walletphk = await Contracts.walletPHK();

        const places = []

        for(const curr of land) {
            const centroid = curr.centroid();
            const pointsrel: number[][] = [];
            curr.pointsRelative(centroid).forEach((p) => {
                pointsrel.push([p.x, 0, p.y])
            });

            places.push(createPlaceTokenMetadata({
                identifier: "some-uuid",
                description: "A nice place",
                minter: walletphk,
                center_coordinates: [centroid.x, 0, centroid.y],
                border_coordinates: pointsrel
            }));
        };

        // Upload all places metadata
        const place_meta_files = await upload_places(places);

        // Mint places
        let batch = Contracts.wallet().batch();
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

                batch = Contracts.wallet().batch();
                batch_size = 0;
            }
        }

        if(batch_size > 0) {
            const batch_op = await batch.send();
            await batch_op.confirmation();
        }
    }

    // Similar to componentDidMount and componentDidUpdate:
    useEffect(() => {
        const dim = 1000;
        const fillColor = '#d6f0ff';
        const strokeColor = '#3d8dba';

        // create canvas
        const draw = new Svg(svgRef.current!).size(dim, dim).viewbox(-dim/2, -dim/2, dim, dim)

        draw.clear();

        const voronoi = new Voronoi();
        const bbox: BoundingBox = {xl: -500, xr: 500, yt: -500, yb: 500}; // xl is x-left, xr is x-right, yt is y-top, and yb is y-bottom
        const sites: Site[] = [];
        const exclusion: ExclusionZone[] = [];

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

        for (let i = 0; i < 4; ++i) {
            generateCircle(sites, exclusion, new Vector2(395 - 65 * i, 275), 65, Angle.FromDegrees(0).radians(), 4);
        }

        for (let i = 0; i < 4; ++i) {
            generateCircle(sites, exclusion, new Vector2(395 - 65 * i, 405), 65, Angle.FromDegrees(0).radians(), 4);
        }

        for (let i = 0; i < 4; ++i) {
            generateCircle(sites, exclusion, new Vector2(-395 + 65 * i, 275), 65, Angle.FromDegrees(0).radians(), 4);
        }

        for (let i = 0; i < 4; ++i) {
            generateCircle(sites, exclusion, new Vector2(-395 + 65 * i, 405), 65, Angle.FromDegrees(0).radians(), 4);
        }

        for (let i = 0; i < 4; ++i) {
            generateCircle(sites, exclusion, new Vector2(395 - 65 * i, -275), 65, Angle.FromDegrees(0).radians(), 4);
        }

        for (let i = 0; i < 4; ++i) {
            generateCircle(sites, exclusion, new Vector2(395 - 65 * i, -405), 65, Angle.FromDegrees(0).radians(), 4);
        }

        for (let i = 0; i < 4; ++i) {
            generateCircle(sites, exclusion, new Vector2(-395 + 65 * i, -275), 65, Angle.FromDegrees(0).radians(), 4);
        }

        for (let i = 0; i < 4; ++i) {
            generateCircle(sites, exclusion, new Vector2(-395 + 65 * i, -405), 65, Angle.FromDegrees(0).radians(), 4);
        }

        generateCircle(sites, exclusion, new Vector2(0, 0), 40, 0, 8);
        generateCircle(sites, exclusion, new Vector2(0, 0), 90, 0, 16);

        generateCircle(sites, exclusion, new Vector2(0, 275 + 65), 80, 0, 5);
        generateCircle(sites, exclusion, new Vector2(0, -275 - 65), 80, Angle.FromDegrees(180).radians(), 5);

        generateCircle(sites, exclusion, new Vector2(-275 - 65, 0), 90, 0, 6);
        generateCircle(sites, exclusion, new Vector2(275 + 65, 0), 90, Angle.FromDegrees(90).radians(), 6);

        generateRandomSites(sites, exclusion, 200, 663);
 
        const diagram: Diagram = voronoi.compute(sites, bbox);

        const landArray: Land[] = []

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

            landArray.push(land);
        }

        for(const land of landArray) {
            land.straightSkeleton(2.5);
        }

        // TODO: tesselate large cells into grids.
        const clippedLand: Land[] = []

        for(const land of landArray) {
            // TODO: exclude certain cells from clipping, by area or id.
            const clipAgainst = (poly: Polygon) => {
                const res = intersection(land.pointsTo2dArray(), poly)

                if(res.length === 1) {
                    const nl = new Land();
                    // need to get points in reverse
                    for(let i = res[0][0].length-1; i > 0 ; --i) {
                        const p = res[0][0][i];
                        nl.points.push(new Vector2(p[0], p[1]));
                    }
                    clippedLand.push(nl);
                }
            }

            // TODO: clip against a grid
            clipAgainst([[[10 + land.center.x, 10 + land.center.y], [-10 + land.center.x, 10 + land.center.y], [-10 + land.center.x, -10 + land.center.y], [10 + land.center.x, -10 + land.center.y]]])
            clipAgainst([[[10 + land.center.x - 20, 10 + land.center.y], [-10 + land.center.x - 20, 10 + land.center.y], [-10 + land.center.x - 20, -10 + land.center.y], [10 + land.center.x - 20, -10 + land.center.y]]])
            clipAgainst([[[10 + land.center.x + 20, 10 + land.center.y], [-10 + land.center.x + 20, 10 + land.center.y], [-10 + land.center.x + 20, -10 + land.center.y], [10 + land.center.x + 20, -10 + land.center.y]]])
        }

        for(const land of clippedLand) {
            land.straightSkeleton(2.5);
            draw.polygon(land.pointsToArray()).fill(fillColor).stroke(strokeColor)
            const centroid = land.centroid();
            draw.circle(4).stroke(strokeColor).fill(strokeColor).move(centroid.x - 2, centroid.y - 2)
            draw.circle(4).stroke('blue').fill('blue').move(land.center.x - 2, land.center.y - 2)
        }

        //mintPlaces(landArray);

        state.svg = draw.svg();
    });

    return (
        <main className="container">
            <button className="btn btn-primary" onClick={() => downloadFile()}>Download SVG</button>
            <svg className="d-block" ref={svgRef}></svg>
        </main>
    );
};