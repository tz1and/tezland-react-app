interface IAppSetting<T> {
    readonly defaultValue: T;

    loadSetting(): T;

    get value(): T;
    set value(newVal: T);
}

type ParseFunc<T> = (value: string) => T

class AppSetting<T extends Object> implements IAppSetting<T> {
    private parseFunc: ParseFunc<T>;
    private _value: T;
    readonly defaultValue: T;

    private settingName: string;

    constructor(settingName: string, defaultValue: T, parseFunc: ParseFunc<T>) {
        this.settingName = settingName;
        this.defaultValue = defaultValue;
        this.parseFunc = parseFunc;

        this._value = this.loadSetting();
    }

    loadSetting(): T {
        const res = localStorage.getItem("tezland:settings:" + this.settingName);
        return res ? this.parseFunc(res) : this.defaultValue;
    }

    get value(): T {
        return this._value;
    }

    set value(newVal: T) {
        this._value = newVal;
        localStorage.setItem("tezland:settings:" + this.settingName, this._value.toString());
    }
}

const parseNumber: ParseFunc<number> = Number;
const parseBool: ParseFunc<boolean> = (value: string) => value === 'true';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const parseString: ParseFunc<string> = (value: string) => value;
const parseShadowOptions: ParseFunc<ShadowOptions> = (value: string) => value as ShadowOptions;
const parseShadowMapRes: ParseFunc<ShadowMapRes> = (value: string) => Number(value) as ShadowMapRes;

export type ShadowOptions = "none" | "standard" | "cascaded";
export type ShadowMapRes = 512 | 1024 | 2048;

export default class AppSettings {
    // general
    static polygonLimit = new AppSetting<number>("polygonLimit", 3072, parseNumber);
    static fileSizeLimit = new AppSetting<number>("fileSizeLimit", 6291456, parseNumber); // MiB default.

    static drawDistance = new AppSetting<number>("drawDistance", 200, parseNumber);

    static displayPlaceBounds = new AppSetting<boolean>("displayPlaceBounds", true, parseBool);
    static showFps = new AppSetting<boolean>("showFps", true, parseBool);

    // controls
    static mouseSensitivity = new AppSetting<number>("mouseSensitivity", 1, parseNumber);

    // graphics
    static enableAntialiasing = new AppSetting<boolean>("enableAntialiasing", true, parseBool);
    static shadowOptions = new AppSetting<ShadowOptions>("shadowOptions", "cascaded", parseShadowOptions);
    static shadowMapRes = new AppSetting<ShadowMapRes>("shadowMapRes", 1024, parseShadowMapRes);
}