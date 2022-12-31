import { Logging } from "./Logging";


export default class RefCounted<T> {
    readonly object: T;
    private _refcount: number;

    public get refcount(): number { return this._refcount; }

    constructor(object: T) {
        this.object = object;
        this._refcount = 0;
    }

    public incRefCount() {
        this._refcount++;
        //Logging.InfoDev("Refcount increased", this);
    }

    public decRefCount() {
        this._refcount--;
        //Logging.InfoDev("Refcount decreased", this);
        if(this._refcount < 0) Logging.ErrorDev("Refcount decreased to < 0", this);
    }
}