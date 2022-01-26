export default class AppSettings {
    static getPolygonLimit(): number {
        const polygonLimit = localStorage.getItem("tezland:settings:polygonLimit");
        return polygonLimit ? parseInt(polygonLimit) : 20000;
    }

    // throws QuotaExceededError
    static setPolygonLimit(limit: number) {
        localStorage.setItem("tezland:settings:polygonLimit", limit.toString());
    }

    static getDisplayPlaceBounds(): boolean {
        const displacPlaceBounds = localStorage.getItem("tezland:settings:displayPlaceBounds");
        return displacPlaceBounds ? (displacPlaceBounds === 'true') : true;
    }

    // throws QuotaExceededError
    static setDisplayPlaceBounds(enable: boolean) {
        localStorage.setItem("tezland:settings:displayPlaceBounds", enable.toString());
    }

    static getDrawDistance(): number {
        const drawDistance = localStorage.getItem("tezland:settings:drawDistance");
        return drawDistance ? parseInt(drawDistance) : 200;
    }

    // throws QuotaExceededError
    static setDrawDistance(dist: number) {
        localStorage.setItem("tezland:settings:drawDistance", dist.toString());
    }

    static getShowFps(): boolean {
        const showFps = localStorage.getItem("tezland:settings:showFps");
        return showFps ? (showFps === 'true') : true;
    }

    // throws QuotaExceededError
    static setShowFps(enable: boolean) {
        localStorage.setItem("tezland:settings:showFps", enable.toString());
    }

    static getFileSizeLimit(): number {
        const fileSizeLimit = localStorage.getItem("tezland:settings:fileSizeLimit");
        return fileSizeLimit ? parseInt(fileSizeLimit) : 67108864;
    }

    // throws QuotaExceededError
    static setFileSizeLimit(limit: number) {
        localStorage.setItem("tezland:settings:fileSizeLimit", limit.toString());
    }
}