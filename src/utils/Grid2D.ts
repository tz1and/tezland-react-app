import assert from "assert";


export type Tuple = [number, number];


export class WorldGridAccessor implements GridAccessor {
    constructor(worldSize: Tuple, worldOffset: Tuple) {
        this.worldSize = worldSize;
        this.worldOffset = worldOffset;
    }

    // figure this shit out.
    private worldSize: Tuple;
    private worldOffset: Tuple;

    accessor(pos: Tuple, gridSize: Tuple): Tuple {
        return [
            Math.floor(gridSize[0] / this.worldSize[0] * (pos[0] + this.worldOffset[0])),
            Math.floor(gridSize[1] / this.worldSize[1] * (pos[1] + this.worldOffset[1]))
        ];
    }
}


export interface GridAccessor {
    // Transforms an input position to
    // to a grid position. truncating to int or so.
    accessor(pos: Tuple, gridSize: Tuple): Tuple;
}


export default class Grid2D<T> {
    constructor(size: Tuple) {
        for (var x=0, width=size[0]; x<width; x++) {
            var row: T[] = [];
            row.length = size[1]; // supposedly resizes the array and fills it with undefined.
            this.grid.push(row);
        }
        this._size = size;
    }

    private _size: Tuple;
    get size(): Tuple { return this._size; }

    private _grid: T[][] = [];
    get grid(): T[][] { return this._grid; }

    // Set grid cell at pos
    public set(pos: Tuple, value: T) {
        assert(pos[0] >= 0 && pos[0] < this.size[0]);
        assert(pos[1] >= 0 && pos[1] < this.size[1]);
        this.grid[pos[0]][pos[1]] = value;
    };

    // Get grid cell at pos
    public get(pos: Tuple): T | undefined {
        assert(pos[0] >= 0 && pos[0] < this.size[0]);
        assert(pos[1] >= 0 && pos[1] < this.size[1]);
        return this.grid[pos[0]][pos[1]];
    }

    public getOrAdd(pos: Tuple, createCallback: () => T): T {
        const val = this.get(pos);
        if(val !== undefined)
            return val;
        else {
            const newVal = createCallback()
            this.set(pos, newVal);
            return newVal;
        }
    }

    // Alternative with an accessor
    public setA(a: GridAccessor, pos: Tuple, value: T) {
        this.set(a.accessor(pos, this.size), value);
    };

    public getA(a: GridAccessor, pos: Tuple): T | undefined {
        return this.get(a.accessor(pos, this.size));
    }

    public getOrAddA(a: GridAccessor, pos: Tuple, createCallback: () => T): T {
        return this.getOrAdd(a.accessor(pos, this.size), createCallback);
    }

    public static max(a: Tuple, b: Tuple) {
        return [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    }

    public static min(a: Tuple, b: Tuple) {
        return [Math.min(a[0], b[0]), Math.min(a[1], b[1])];
    }

    public clear() {
        this._grid = [];
    }
}

// TODO: write some tests