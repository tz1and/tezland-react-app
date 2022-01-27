import { isDev } from "./Utils"

export namespace Logging {
    export const Log = console.log.bind(window.console);
    export const Info = console.info.bind(window.console);
    export const Warn = console.warn.bind(window.console);
    export const Error = console.error.bind(window.console);

    export const LogDev = isDev() ? console.log.bind(window.console) : () => {};
    export const InfoDev = isDev() ? console.info.bind(window.console) : () => {};
    export const WarnDev = isDev() ? console.warn.bind(window.console) : () => {};
    export const ErrorDev = isDev() ? console.error.bind(window.console) : () => {};

    export const Dir = console.dir.bind(window.console);
    export const DirDev = isDev() ? console.dir.bind(window.console) : () => {};
}