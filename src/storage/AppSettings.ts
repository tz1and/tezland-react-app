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
}