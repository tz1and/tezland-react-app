import assert from "assert";


export class WorldGridAccessor implements GridAccessor {
    constructor(worldSize: [number, number], worldOffset: [number, number]) {
        this.worldSize = worldSize;
        this.worldOffset = worldOffset;
    }

    // figure this shit out.
    private worldSize: [number, number];
    private worldOffset: [number, number];

    accessor(pos: [number, number], gridSize: [number, number]): [number, number] {
        console.log("world", pos);
        return [
            Math.floor(gridSize[0] / this.worldSize[0] * (pos[0] + this.worldOffset[0])),
            Math.floor(gridSize[1] / this.worldSize[1] * (pos[1] + this.worldOffset[1]))
        ];
    }
}


export interface GridAccessor {
    // Transforms an input position to
    // to a grid position. truncating to int or so.
    accessor(pos: [number, number], gridSize: [number, number]): [number, number];
}


export default class Grid2D<T> {
    constructor(size: [number, number]) {
        for (var x=0, width=size[0]; x<width; x++) {
            var row: T[] = [];
            row.length = size[1]; // supposedly resizes the array and fills it with undefined.
            this.grid.push(row);
        }
        this._size = size;
    }

    private _size: [number, number];
    get size(): [number, number] { return this._size; }

    private _grid: T[][] = [];
    get grid(): T[][] { return this._grid; }

    // Set grid cell at pos
    public set(pos: [number, number], value: T) {
        console.log("index", pos);
        assert(pos[0] >= 0 && pos[0] < this.size[0]);
        assert(pos[1] >= 0 && pos[1] < this.size[1]);
        this.grid[pos[0]][pos[1]] = value;
    };

    // Get grid cell at pos
    public get(pos: [number, number]): T | undefined {
        console.log("index", pos);
        assert(pos[0] >= 0 && pos[0] < this.size[0]);
        assert(pos[1] >= 0 && pos[1] < this.size[1]);
        return this.grid[pos[0]][pos[1]];
    }

    // Alternative with an accessor
    public setA(a: GridAccessor, pos: [number, number], value: T) {
        this.set(a.accessor(pos, this.size), value);
    };

    public getA(a: GridAccessor, pos: [number, number]) {
        return this.get(a.accessor(pos, this.size));
    }

    public clear() {
        this._grid = [];
    }
}

// TODO: write some tests