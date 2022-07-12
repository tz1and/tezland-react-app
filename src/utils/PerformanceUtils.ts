import { Logging } from "./Logging";

export namespace PerformanceUtils {
    export function printMeasure(m: PerformanceEntry) {
        Logging.InfoDev(`${m.name}: took ${m.duration}ms`);
    }
}