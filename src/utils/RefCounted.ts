import { Logging } from "./Logging";


export default abstract class RefCounted {
    private _refcount: number;

    public get refcount(): number { return this._refcount; }

    constructor() {
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