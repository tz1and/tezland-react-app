import { Vector2 } from "@babylonjs/core";
import { Matrix2D } from "@babylonjs/gui";
import { Polygon, Ring } from "polygon-clipping";


export const translateAndRotate = (x: number, y: number, r: number): Matrix2D => {
    const m_t = Matrix2D.Identity();
    Matrix2D.TranslationToRef(x, y, m_t);
    const m_r = Matrix2D.Identity();
    Matrix2D.RotationToRef(r, m_r);
    const m = Matrix2D.Identity();
    m_r.multiplyToRef(m_t, m);
    return m;
}

/*export const rotateAndTranslate = (x: number, y: number, r: number): Matrix2D => {
    const m_t = Matrix2D.Identity();
    Matrix2D.TranslationToRef(x, y, m_t);
    const m_r = Matrix2D.Identity();
    Matrix2D.RotationToRef(r, m_r);
    const m = Matrix2D.Identity();
    m_t.multiplyToRef(m_r, m);
    return m;
}*/

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default class Rectangle {
    public width: number;
    public height: number;

    public pos: Vector2;
    public angle: number; // in radians
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