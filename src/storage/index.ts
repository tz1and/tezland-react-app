export * from "./DatabaseStorage";
export * from "./FallbackStorage";
export * from "./IStorageProvider";
// don't export AppSettings, because stoage is included in WebWorkers.
//export * from "./AppSettings";