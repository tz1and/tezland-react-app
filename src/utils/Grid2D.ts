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


class BaseGrid2D<T> {
    constructor(size: Tuple) {
        this._size = size;
    }

    protected _size: Tuple;
    getSize(): Tuple { return this._size; }

    // Set grid cell at pos
    public set(pos: Tuple, value: T) {
        throw new Error("not implemented")
    }

    // Get grid cell at pos
    public get(pos: Tuple): T | undefined {
        throw new Error("not implemented")
    }

    public getOrAdd(pos: Tuple, createCallback: () => T): T {
        throw new Error("not implemented")
    }

    // Alternative with an accessor
    public setA(a: GridAccessor, pos: Tuple, value: T) {
        this.set(a.accessor(pos, this._size), value);
    };

    public getA(a: GridAccessor, pos: Tuple): T | undefined {
        return this.get(a.accessor(pos, this._size));
    }

    public getOrAddA(a: GridAccessor, pos: Tuple, createCallback: () => T): T {
        return this.getOrAdd(a.accessor(pos, this._size), createCallback);
    }

    public static max(a: Tuple, b: Tuple) {
        return [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    }

    public static min(a: Tuple, b: Tuple) {
        return [Math.min(a[0], b[0]), Math.min(a[1], b[1])];
    }

    public clear() {
        throw new Error("not implemented")
    }
}


export default class Grid2D<T> extends BaseGrid2D<T> {
    constructor(size: Tuple) {
        super(size);

        for (var x=0, width=size[0]; x<width; x++) {
            var row: T[] = [];
            row.length = size[1]; // supposedly resizes the array and fills it with undefined.
            this._grid.push(row);
        }
    }

    protected _grid: T[][] = [];
    getGrid(): T[][] { return this._grid; }

    // TODO: asserts are slow!

    // Set grid cell at pos
    public override set(pos: Tuple, value: T) {
        assert(pos[0] >= 0 && pos[0] < this._size[0]);
        assert(pos[1] >= 0 && pos[1] < this._size[1]);
        this._grid[pos[0]][pos[1]] = value;
    };

    // Get grid cell at pos
    public override get(pos: Tuple): T | undefined {
        assert(pos[0] >= 0 && pos[0] < this._size[0]);
        assert(pos[1] >= 0 && pos[1] < this._size[1]);
        return this._grid[pos[0]][pos[1]];
    }

    public override getOrAdd(pos: Tuple, createCallback: () => T): T {
        const val = this.get(pos);
        if(val !== undefined)
            return val;
        else {
            const newVal = createCallback()
            this.set(pos, newVal);
            return newVal;
        }
    }

    public override clear() {
        this._grid = [];
    }
}


export class GridBenchmark {
    constructor(grid: BaseGrid2D<number>) {
        this.gridConstructor = grid.constructor as (size: Tuple) => BaseGrid2D<number>;
    }

    private gridConstructor: (size: Tuple) => BaseGrid2D<number>;

    private benchmark(name: string, fn: () => void) {
        try {
            const start_time = performance.now();
            fn();
            const elapsed = performance.now() - start_time;
            console.log(`${name}: ${elapsed.toFixed(2)}ms`);
        } catch(e) {
            console.log(`${name} failed: ${e}`);
        }
    }

    private stress_grid_write(g: BaseGrid2D<number>, size: Tuple) {
        // Fill it with 1's
        var w = size[0]-1, h = size[1]-1;
        for(var x=w; x>=0; x--) {
            for(var y=h; y>=0; y--) {
                g.set([x,y], 1);
            }
        }
    }

    private stress_grid_read(g: BaseGrid2D<number>, size: Tuple) {
        // Read all the 1's
        var w = size[0]-1, h = size[1]-1;
        for(var x=w; x>=0; x--) {
            for(var y=h; y>=0; y--) {
                g.get([x,y]);
            }
        }
    }

    private stress_full(size: Tuple) {
        let a: BaseGrid2D<number>;
        // @ts-expect-error
        this.benchmark('create ' + size, () => { a = new this.gridConstructor(size); });
        this.benchmark('write ' + size, () => { this.stress_grid_write(a, size); });
        this.benchmark('read ' + size, () => { this.stress_grid_read(a, size); });
    }

    public run(size: Tuple) {
        this.benchmark('total ' + size, () => { this.stress_full(size); });
    }
}