import { isDev } from "../tz/Utils"

export namespace Logging {
    export const Error = console.error.bind(window.console);
    export const Warn = console.warn.bind(window.console);
    export const Info = console.info.bind(window.console);
    export const Log = console.log.bind(window.console);

    export const InfoDev = isDev() ? console.info.bind(window.console) : () => {};
}