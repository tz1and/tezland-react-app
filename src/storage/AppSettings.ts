export default class AppSettings {

    static defaults = {
        polygonLimit: 10000,
        fileSizeLimit: 16777216, // 16 Mb
        drawDistance: 200,
        displacPlaceBounds: true,
        showFps: true,
    };

    static getPolygonLimit(): number {
        const polygonLimit = localStorage.getItem("tezland:settings:polygonLimit");
        return polygonLimit ? parseInt(polygonLimit) : this.defaults.polygonLimit;
    }

    // throws QuotaExceededError
    static setPolygonLimit(limit: number) {
        localStorage.setItem("tezland:settings:polygonLimit", limit.toString());
    }

    static getDisplayPlaceBounds(): boolean {
        const displacPlaceBounds = localStorage.getItem("tezland:settings:displayPlaceBounds");
        return displacPlaceBounds ? (displacPlaceBounds === 'true') : this.defaults.displacPlaceBounds;
    }

    // throws QuotaExceededError
    static setDisplayPlaceBounds(enable: boolean) {
        localStorage.setItem("tezland:settings:displayPlaceBounds", enable.toString());
    }

    static getDrawDistance(): number {
        const drawDistance = localStorage.getItem("tezland:settings:drawDistance");
        return drawDistance ? parseInt(drawDistance) : this.defaults.drawDistance;
    }

    // throws QuotaExceededError
    static setDrawDistance(dist: number) {
        localStorage.setItem("tezland:settings:drawDistance", dist.toString());
    }

    static getShowFps(): boolean {
        const showFps = localStorage.getItem("tezland:settings:showFps");
        return showFps ? (showFps === 'true') : this.defaults.showFps;
    }

    // throws QuotaExceededError
    static setShowFps(enable: boolean) {
        localStorage.setItem("tezland:settings:showFps", enable.toString());
    }

    static getFileSizeLimit(): number {
        const fileSizeLimit = localStorage.getItem("tezland:settings:fileSizeLimit");
        return fileSizeLimit ? parseInt(fileSizeLimit) : this.defaults.fileSizeLimit;
    }

    // throws QuotaExceededError
    static setFileSizeLimit(limit: number) {
        localStorage.setItem("tezland:settings:fileSizeLimit", limit.toString());
    }
}