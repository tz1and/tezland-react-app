interface IAppSetting<T> {
    readonly defaultValue: T;

    loadSetting(): T;

    get value(): T;
    set value(newVal: T);
}

type CtorFunc<T> = new(value?: any) => T

class AppSetting<T extends Object> implements IAppSetting<T> {
    private valCtor: CtorFunc<T>;
    private _value: T;
    readonly defaultValue: T;

    private settingName: string;

    constructor(settingName: string, defaultValue: T, ctr: CtorFunc<T>) {
        this.settingName = settingName;
        this.defaultValue = defaultValue;
        this.valCtor = ctr;

        this._value = this.loadSetting();
    }

    loadSetting(): T {
        const res = localStorage.getItem("tezland:settings:" + this.settingName);
        return res ? new this.valCtor(res) : this.defaultValue;
    }

    get value(): T {
        return this._value;
    }

    set value(newVal: T) {
        this._value = newVal;
        localStorage.setItem("tezland:settings:" + this.settingName, this._value.toString());
    }
}

const numberCtor = Number.prototype.constructor as CtorFunc<number>;
const boolCtor = Boolean.prototype.constructor as CtorFunc<boolean>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const stringCtor = String.prototype.constructor as CtorFunc<string>;

export default class AppSettings {
    // general
    static polygonLimit = new AppSetting<number>("polygonLimit", 3072, numberCtor);
    static fileSizeLimit = new AppSetting<number>("fileSizeLimit", 6291456, numberCtor); // MiB default.

    static drawDistance = new AppSetting<number>("drawDistance", 200, numberCtor);

    static displayPlaceBounds = new AppSetting<boolean>("displayPlaceBounds", true, boolCtor);
    static showFps = new AppSetting<boolean>("showFps", true, boolCtor);

    // controls
    static mouseSensitivity = new AppSetting<number>("mouseSensitivity", 1, numberCtor);

    // graphics
    static enableAntialiasing = new AppSetting<boolean>("enableAntialiasing", true, boolCtor);
    static enableShadows = new AppSetting<boolean>("enableShadows", true, boolCtor);
}