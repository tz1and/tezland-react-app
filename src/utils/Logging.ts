import { isDev } from "./Utils"

const theWindow = typeof window !== 'undefined' ? window : globalThis;

export namespace Logging {
    // TODO: window or globalThis
    export const Log = console.log.bind(theWindow.console);
    export const Info = console.info.bind(theWindow.console);
    export const Warn = console.warn.bind(theWindow.console);
    export const Error = console.error.bind(theWindow.console);

    export const LogDev = isDev() ? console.log.bind(theWindow.console) : () => {};
    export const InfoDev = isDev() ? console.info.bind(theWindow.console) : () => {};
    export const WarnDev = isDev() ? console.warn.bind(theWindow.console) : () => {};
    export const ErrorDev = isDev() ? console.error.bind(theWindow.console) : () => {};

    export const Dir = console.dir.bind(theWindow.console);
    export const DirDev = isDev() ? console.dir.bind(theWindow.console) : () => {};
}