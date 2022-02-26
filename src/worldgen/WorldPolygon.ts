import { Vector2 } from "@babylonjs/core";
import { signedArea } from "../utils/Utils";
import { intersection, Polygon, Ring } from 'polygon-clipping';
import { IDeepEquals } from "../utils/Sets";


class Edge implements IDeepEquals {
    constructor(a: Vector2, b: Vector2) {
        this.a = a.clone(); //roundVector2(a);
        this.b = b.clone(); //roundVector2(b);
    }

    public a: Vector2;
    public b: Vector2;

    /*private static ExtractAsInt(value: number) {
        return parseInt(value.toString());
    };

    private static hashFloats(_x1: number, _y1: number, _x2: number, _y2: number) {
        var x1 = Edge.ExtractAsInt(_x1);
        var y1 = Edge.ExtractAsInt(_y1);
        var x2 = Edge.ExtractAsInt(_x2);
        var y2 = Edge.ExtractAsInt(_y2);
        var hash = _x1;
        hash = (hash * 397) ^ _y1;
        hash = (hash * 397) ^ _x2;
        hash = (hash * 397) ^ _y2;
        console.log("hash", hash)
        return hash;
    }

    public getHashCode(): number {
        return a.x > b.x && a.y > b.y ? Edge.hashFloats(a.x, a.y, b.x, b.y) :
            Edge.hashFloats(b.x, b.y, a.x, a.y);
    }*/

    public deepEquals(other: Edge): boolean {
        const epsilon = 0.001;
        return this.a.x > this.b.x ? this.a.equalsWithEpsilon(other.a, epsilon) && this.b.equalsWithEpsilon(other.b, epsilon) :
            this.a.equalsWithEpsilon(other.b, epsilon) && this.b.equalsWithEpsilon(other.a, epsilon);
    }

    public pointsToArray(): number[] {
        return this.a.asArray().concat(this.b.asArray());
    }
}

export default class WorldPolygon {
    public center: Vector2;
    public vertices: Vector2[];

    constructor(center: Vector2, vertices: Vector2[]) {
        this.center = center;
        this.vertices = vertices;
    }

    // convert to an array of numbers
    public verticesToArray(translate: Vector2 = new Vector2()): number[] {
        const arr: number[] = []

        this.vertices.forEach((v) => {
            arr.push(v.x + translate.x, v.y + translate.y);
        })

        return arr;
    }

    // convert to a polygon-clipping polygon
    public verticesToPolygon(): Polygon {
        const arr: Ring = []

        this.vertices.forEach((v) => {
            arr.push([v.x, v.y]);
        })

        return [arr];
    }

    // compute the signedArea
    public signedArea(): number {
        let area = 0.0;
       
        for (let i = 0; i < this.vertices.length; i++) {
            let j = (i + 1) % this.vertices.length;
            area += (this.vertices[j].x - this.vertices[i].x) * (this.vertices[j].y + this.vertices[i].y);
        }
       
        return area / 2.0;
    }

    // just an alias for signedArea.
    public area(): number {
        return this.signedArea();
        /*const verts = this.verticesToArray();
        var polygonArea = Math.abs(signedArea(verts, 0, verts.length, 2));
        return polygonArea;*/
    }

    // get edges
    public edges(): Edge[] {
        const edges: Edge[] = [];

        for(let i = 0; i < this.vertices.length; ++i) {
            edges.push(new Edge(this.vertices[i], this.vertices[(i + 1) % this.vertices.length]));
        }
        return edges;
    }

    // compute the centroid
    public centroid(translate: Vector2 = new Vector2()): Vector2 {
        const centroid = new Vector2();

        this.vertices.forEach((v) => {
            centroid.addInPlace(v);
        })
        centroid.divideInPlace(new Vector2(this.vertices.length, this.vertices.length));

        return centroid.add(translate);
    }

    // get vertices relative to position.
    public verticesRelative(rel: Vector2): Vector2[] {
        const relpoints: Vector2[] = [];

        this.vertices.forEach((v) => {
            relpoints.push(v.subtract(rel));
        });

        return relpoints;
    }

    // naive shrink. rather use straight skeleton.
    public naiveShrink(s: number) {
        const newpoints: Vector2[] = [];

        const centroid = this.centroid();
        console.log(centroid);

        this.vertices.forEach((v) => {
            const fromCenter = v.subtract(centroid)

            const newLen = fromCenter.length() - s;
            newpoints.push(fromCenter.normalize().scale(newLen).add(centroid))
        })

        this.vertices = newpoints;
    }

    // preprocess the points to remove any points closer together than spacing
    private preprocess(spacing: number) {
        const preprocess_points: Vector2[] = [];

        for(let i = 0; i < this.vertices.length; ++i) {
            const nextPoint = this.vertices[(i+1) % this.vertices.length]
            const vec = this.vertices[i].subtract(nextPoint)

            // If this and the next point aren't too close together, add this point.
            if(vec.length() > spacing) preprocess_points.push(this.vertices[i]);

            // If they are, set the next point to the centroid of this and the next point.
            else nextPoint.addInPlace(this.vertices[i]).divideInPlace(new Vector2(2, 2));
        }

        this.vertices = preprocess_points;
    }

    public straightSkeleton(spacing: number) {

        this.preprocess(spacing * 1.2);

        // http://stackoverflow.com/a/11970006/796832
        // Accompanying Fiddle: http://jsfiddle.net/vqKvM/35/

        const resulting_path: Vector2[] = [];
        const N = this.vertices.length;
        var mi, mi1, li, li1, ri, ri1, si, si1, Xi1, Yi1;
        for (var i = 0; i < N; i++) {
            mi = (this.vertices[(i + 1) % N].y - this.vertices[i].y) / (this.vertices[(i + 1) % N].x - this.vertices[i].x);
            mi1 = (this.vertices[(i + 2) % N].y - this.vertices[(i + 1) % N].y) / (this.vertices[(i + 2) % N].x - this.vertices[(i + 1) % N].x);
            li = Math.sqrt((this.vertices[(i + 1) % N].x - this.vertices[i].x) * (this.vertices[(i + 1) % N].x - this.vertices[i].x) + (this.vertices[(i + 1) % N].y - this.vertices[i].y) * (this.vertices[(i + 1) % N].y - this.vertices[i].y));
            li1 = Math.sqrt((this.vertices[(i + 2) % N].x - this.vertices[(i + 1) % N].x) * (this.vertices[(i + 2) % N].x - this.vertices[(i + 1) % N].x) + (this.vertices[(i + 2) % N].y - this.vertices[(i + 1) % N].y) * (this.vertices[(i + 2) % N].y - this.vertices[(i + 1) % N].y));
            ri = this.vertices[i].x + spacing * (this.vertices[(i + 1) % N].y - this.vertices[i].y) / li;
            ri1 = this.vertices[(i + 1) % N].x + spacing * (this.vertices[(i + 2) % N].y - this.vertices[(i + 1) % N].y) / li1;
            si = this.vertices[i].y - spacing * (this.vertices[(i + 1) % N].x - this.vertices[i].x) / li;
            si1 = this.vertices[(i + 1) % N].y - spacing * (this.vertices[(i + 2) % N].x - this.vertices[(i + 1) % N].x) / li1;
            Xi1 = (mi1 * ri1 - mi * ri + si - si1) / (mi1 - mi);
            Yi1 = (mi * mi1 * (ri1 - ri) + mi1 * si - mi * si1) / (mi1 - mi);
            // Correction for vertical lines
            if (this.vertices[(i + 1) % N].x - this.vertices[i % N].x === 0) {
                Xi1 = this.vertices[(i + 1) % N].x + spacing * (this.vertices[(i + 1) % N].y - this.vertices[i % N].y) / Math.abs(this.vertices[(i + 1) % N].y - this.vertices[i % N].y);
                Yi1 = mi1 * Xi1 - mi1 * ri1 + si1;
            }
            if (this.vertices[(i + 2) % N].x - this.vertices[(i + 1) % N].x === 0) {
                Xi1 = this.vertices[(i + 2) % N].x + spacing * (this.vertices[(i + 2) % N].y - this.vertices[(i + 1) % N].y) / Math.abs(this.vertices[(i + 2) % N].y - this.vertices[(i + 1) % N].y);
                Yi1 = mi * Xi1 - mi * ri + si;
            }

            //console.log("mi:", mi, "mi1:", mi1, "li:", li, "li1:", li1);
            //console.log("ri:", ri, "ri1:", ri1, "si:", si, "si1:", si1, "Xi1:", Xi1, "Yi1:", Yi1);

            resulting_path.push(new Vector2(Xi1, Yi1));
        }

        this.vertices = resulting_path;
    }

    public static clipAgainst<TIn extends WorldPolygon, TOut extends WorldPolygon>(land: TIn, poly: Polygon, tout_constructor: { new(...args : any[]): TOut }): TOut[] {

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
            const res = intersection(land.verticesToPolygon(), poly)

            const landArr: TOut[] = [];
            for (const resP of res) {
            //if(res.length === 1) {
                const vertices: Vector2[] = [];
                // need to get points in reverse
                for(let i = resP[0].length-1; i > 0 ; --i) {
                    const p = resP[0][i];
                    vertices.push(new Vector2(p[0], p[1]));
                }
                const nl = new tout_constructor(new Vector2(), vertices);
                nl.center = nl.centroid();
                landArr.push(nl);
            }
            return landArr;
        } catch(e: any) { console.log(e); console.log(poly); console.log(land); }

        return [];
    }

    // Note: clones only the world polygon part as type T
    public static clone<T extends WorldPolygon>(poly: T, constructor: { new(...args : any[]): T }): T {
        return new constructor(poly.center, poly.vertices);
    }
}