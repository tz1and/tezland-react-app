export default class AppSettings {
    static getPolygonLimit(): number {
        const _polygonLimit = localStorage.getItem("tezland:settings:polygonLimit");
        return _polygonLimit ? parseInt(_polygonLimit) : 20000;
    }

    // throws QuotaExceededError
    static setPolygonLimit(limit: number) {
        localStorage.setItem("tezland:settings:polygonLimit", limit.toString());
    }
}