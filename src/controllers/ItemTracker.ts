import { Logging } from "../utils/Logging";

type TempItem = {
    count: number;
}

type TempItemsMap = Map<number, TempItem>;

type PlaceMap = Map<number, TempItemsMap>;

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
    public trackTempItem(placeId: number, itemId: number, count: number) {
        const tempItemsMap = this.getOrAddTempItemsMap(placeId);

        this.addItemToTempItemsMap(tempItemsMap, itemId, count);

        // Remove place if it tracks no items.
        if (tempItemsMap.size === 0) this.placeMap.delete(placeId);
    }

    /**
     * Returns the count for a certain item in all places.
     * @param itemId 
     */
    public getTempItemTrack(itemId: number): number {
        let trackedCount = 0;
        for (const p of this.placeMap.values()) {
            const i = p.get(itemId);
            if (i) trackedCount += i.count;
        }

        return trackedCount;
    }

    /**
     * returns a list of all tracked items in all places.
     */
    public getTrackedTempItems(): number[] {
        const itemSet = new Set<number>();

        for (const p of this.placeMap.values()) {
            for (const id of p.keys()) {
                itemSet.add(id);
            }
        }

        return [...itemSet.values()];
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

    private addItemToTempItemsMap(tempItemsMap: TempItemsMap, itemId: number, count: number) {
        let tempItem = tempItemsMap.get(itemId)
        if (tempItem) {
            tempItem.count += count;

            // remove when it hits 0
            if (tempItem.count === 0) tempItemsMap.delete(itemId);
            return;
        }

        tempItem = { count: count };
        tempItemsMap.set(itemId, tempItem);
    }

    private getOrAddTempItemsMap(placeId: number): TempItemsMap {
        let res = this.placeMap.get(placeId);
        if (res) return res;

        res = new Map();
        this.placeMap.set(placeId, res);
        return res;
    }
}

export default new ItemTracker();