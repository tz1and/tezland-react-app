export interface IHash {
    getHashCode(): number;
}

export class HashSet<T extends IHash> {
    private map: Map<number, T>;

    constructor() {
        this.map = new Map();
    }

    add(item: T) {
        this.map.set(item.getHashCode(), item);
    }

    [Symbol.iterator]() {
        return this.map.values()
    }

    values() {
        return this.map.values();
    }

    delete(item: T) {
        return this.map.delete(item.getHashCode());
    }

    get size(): number {
        return this.map.size;
    }
}

export interface IDeepEquals {
    deepEquals(other: IDeepEquals): boolean;
}

// Don't judge.
export class DeepEqualsSet<T extends IDeepEquals> {
    private _arr: Array<T>;

    constructor() {
        this._arr = new Array();
    }

    add(item: T) {
        for (let x of this._arr) {
            if(x.deepEquals(item)) return;
        }
        
        this._arr.push(item);
    }

    [Symbol.iterator]() {
        return this._arr.values()
    }

    values() {
        return this._arr.values();
    }

    get size(): number {
        return this._arr.length;
    }

    get arr(): Array<T> {
        return this._arr;
    }
}