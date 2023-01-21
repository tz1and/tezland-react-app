import Conf from "../Config";
import { Logging } from "../utils/Logging";
import PlaceKey from "../utils/PlaceKey";


const localStorageAvailable = typeof localStorage !== 'undefined';
if (!localStorageAvailable) Logging.WarnDev("local storage not available");

interface IAppSetting<T> {
    readonly defaultValue: T;

    loadSetting(): T;

    get value(): T;
    set value(newVal: T);
}

type ParseFunc<T> = (value: string) => T
type SerialiseFunc<T> = (value: T) => string

class AppSetting<T extends Object> implements IAppSetting<T> {
    private parseFunc: ParseFunc<T>;
    private serialiseFunc: SerialiseFunc<T>;
    private _value: T;
    readonly defaultValue: T;

    private settingName: string;

    constructor(settingName: string, defaultValue: T, parseFunc: ParseFunc<T>, serialiseFunc: SerialiseFunc<T>) {
        this.settingName = settingName;
        this.defaultValue = defaultValue;
        this.parseFunc = parseFunc;
        this.serialiseFunc = serialiseFunc;

        this._value = this.loadSetting();
    }

    loadSetting(): T {
        if (!localStorageAvailable) return this.defaultValue;
        const res = localStorage.getItem("tezland:settings:" + this.settingName);
        return res ? this.parseFunc(res) : this.defaultValue;
    }

    settingExists(): boolean {
        if (!localStorageAvailable) return false;
        const res = localStorage.getItem("tezland:settings:" + this.settingName);
        return res !== null;
    }

    get value(): T {
        return this._value;
    }

    set value(newVal: T) {
        this._value = newVal;
        if (localStorageAvailable) localStorage.setItem("tezland:settings:" + this.settingName, this.serialiseFunc(this._value));
    }
}

const placeKeyDefault = new PlaceKey(1, "district");

const parseNumber: ParseFunc<number> = Number;
const parseBool: ParseFunc<boolean> = (value: string) => value === 'true';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const parseString: ParseFunc<string> = (value: string) => value;
const parseShadowOptions: ParseFunc<ShadowOptions> = (value: string) => value as ShadowOptions;
const parseTextureRes: ParseFunc<TextureRes> = (value: string) => Number(value) as TextureRes;
const parsePlaceKey: ParseFunc<PlaceKey> = (value: string) => {
    try {
        // Try parse place key.
        const place_key = PlaceKey.fromJson(value);
        if (place_key.id !== undefined && place_key.fa2 !== undefined)
            return place_key;
        // Else, parse value as int.
        else return new PlaceKey(parseInt(value), Conf.place_contract);
    } catch(e) {
        return placeKeyDefault;
    }
}

const serialiseToString: SerialiseFunc<number | string | boolean> = (value: number | string | boolean) => value.toString();
const serialiseToJson: SerialiseFunc<any> = (value: any) => JSON.stringify(value);

export type ShadowOptions = "none" | "standard" | "cascaded";
export type TextureRes = 128 | 256 | 512 | 1024 | 2048 | 4096;

export default class AppSettings {
    // general
    static triangleLimit = new AppSetting<number>("triangleLimit", 5120, parseNumber, serialiseToString);
    static fileSizeLimit = new AppSetting<number>("fileSizeLimit", 6291456, parseNumber, serialiseToString); // MiB default.

    static triangleLimitInterior = new AppSetting<number>("triangleLimitInterior", 30720, parseNumber, serialiseToString);
    static fileSizeLimitInterior = new AppSetting<number>("fileSizeLimitInterior", 25165824, parseNumber, serialiseToString); // MiB default.

    static displayPlaceBounds = new AppSetting<boolean>("displayPlaceBounds", false, parseBool, serialiseToString);
    static showFps = new AppSetting<boolean>("showFps", true, parseBool, serialiseToString);

    static transferToPlaceIfOwner = new AppSetting<boolean>("transferToPlaceIfOwner", true, parseBool, serialiseToString);

    // controls
    static mouseSensitivity = new AppSetting<number>("mouseSensitivity", 1, parseNumber, serialiseToString);
    static mouseInertia = new AppSetting<number>("mouseInertia", 0.5, parseNumber, serialiseToString);

    // graphics
    static enableAntialiasing = new AppSetting<boolean>("enableAntialiasing", true, parseBool, serialiseToString);
    static shadowOptions = new AppSetting<ShadowOptions>("shadowOptions", "none", parseShadowOptions, serialiseToString);
    static shadowMapRes = new AppSetting<TextureRes>("shadowMapRes", 512, parseTextureRes, serialiseToString);
    static textureRes = new AppSetting<TextureRes>("textureRes", 512, parseTextureRes, serialiseToString);
    static fovHorizontal = new AppSetting<number>("fovHorizontal", 90, parseNumber, serialiseToString);

    static enableFxaa = new AppSetting<boolean>("enableFxaa", true, parseBool, serialiseToString);
    static highPrecisionShaders = new AppSetting<boolean>("highPrecisionShaders", true, parseBool, serialiseToString);

    static drawDistance = new AppSetting<number>("drawDistance", 125, parseNumber, serialiseToString);

    // postprocessing
    static enableBloom = new AppSetting<boolean>("enableBloom", true, parseBool, serialiseToString);
    static enableGrain = new AppSetting<boolean>("enableGrain", true, parseBool, serialiseToString);

    // rpc and related options
    static rpcNode = new AppSetting<number>("rpcNode", 0, parseNumber, serialiseToString);

    // default spawn
    static defaultSpawn = new AppSetting<PlaceKey>("defaultSpawn", placeKeyDefault, parsePlaceKey, serialiseToJson);
}

export class AppTerms {
    static termsAccepted = new AppSetting<boolean>("termsAccepted", false, parseBool, serialiseToString);
}

export const settingsVersion = new AppSetting<number>("settingsVersion", 1, parseNumber, serialiseToString);
const current_settings_version = () => settingsVersion.settingExists() ? settingsVersion.loadSetting() : 0;

// Updating client settings. To be used for increasing the defaults, etc.
export const upgradeSettings = () => {
    Logging.InfoDev("Checking for settings updates.");

    // upgrade to version 1
    if (current_settings_version() < 1) {
        Logging.Info("Updating client settings to version 1");
        AppSettings.shadowOptions.value = "none";
        AppSettings.displayPlaceBounds.value = false;
        AppSettings.drawDistance.value = 125;
        settingsVersion.value = 1;
    }

    if (current_settings_version() < 2) {
        Logging.Info("Updating client settings to version 2");
        AppSettings.shadowMapRes.value = 512;
        AppSettings.textureRes.value = 512;
        settingsVersion.value = 2;
    }
}