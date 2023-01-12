import { Logging } from "../utils/Logging";
import TokenKey from "../utils/TokenKey";

type TempItem = {
    tokenKey: TokenKey;
    count: number;
}

type TempItemsMap = Map<string, TempItem>;

type PlaceMap = Map<number, TempItemsMap>;

// IMPORTANT! TODO: the item tracker will probably work fine for inteiors as well as exteriors, but better safe than sorry.
class ItemTracker {
    private placeMap: PlaceMap;

    constructor() {
        this.placeMap = new Map();
    }

    /**
     * Tracks a temporarily added/removed item.
     * @param placeId 
     * @param itemId 
     * @param count Can be negative.
     */
    public trackTempItem(placeId: number, tokenKey: TokenKey, count: number) {
        const tempItemsMap = this.getOrAddTempItemsMap(placeId);

        this.addItemToTempItemsMap(tempItemsMap, tokenKey, count);

        // Remove place if it tracks no items.
        if (tempItemsMap.size === 0) this.placeMap.delete(placeId);
    }

    /**
     * Returns the count for a certain item in all places.
     * @param itemId 
     */
    public getTempItemTrack(tokenKey: TokenKey): number {
        let trackedCount = 0;
        for (const p of this.placeMap.values()) {
            const i = p.get(tokenKey.toString());
            if (i) trackedCount += i.count;
        }

        return trackedCount;
    }

    /**
     * returns a map of fa2 to list of ids of all tracked items in all places.
     */
    public getTrackedTempItems(): Map<string, Set<number>> {
        const fa2ToIdsMap = new Map<string, Set<number>>()

        for (const p of this.placeMap.values()) {
            for (const tempItem of p.values()) {
                const idSet = fa2ToIdsMap.get(tempItem.tokenKey.fa2);
                if (idSet !== undefined)
                    idSet.add(tempItem.tokenKey.id.toNumber());
                else {
                    fa2ToIdsMap.set(tempItem.tokenKey.fa2, new Set([tempItem.tokenKey.id.toNumber()]));
                }
            }
        }

        return fa2ToIdsMap;
    }

    /**
     * Removes tracked items for a place (use when place is unloaded or saved)
     * @param placeId 
     */
    public removeTrackedItemsForPlace(placeId: number) {
        this.placeMap.delete(placeId);
    }

    public log() {
        Logging.Info(this.placeMap);
    }

    private addItemToTempItemsMap(tempItemsMap: TempItemsMap, tokenKey: TokenKey, count: number) {
        let tempItem = tempItemsMap.get(tokenKey.toString())
        if (tempItem) {
            tempItem.count += count;

            // remove when it hits 0
            if (tempItem.count === 0) tempItemsMap.delete(tokenKey.toString());
            return;
        }

        tempItem = { tokenKey: tokenKey, count: count };
        tempItemsMap.set(tokenKey.toString(), tempItem);
    }

    private getOrAddTempItemsMap(placeId: number): TempItemsMap {
        let res = this.placeMap.get(placeId);
        if (res) return res;

        res = new Map();
        this.placeMap.set(placeId, res);
        return res;
    }
}

const itemTracker = new ItemTracker();
export default itemTracker;