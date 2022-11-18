import { DBSchema, StoreKey, StoreNames, StoreValue } from "idb";
import { WorldGridCell } from "../utils/WorldGrid";
import { PlaceTokenMetadata, ItemTokenMetadata } from "../world/Metadata";
import { PlaceData } from "../world/nodes/BasePlaceNode";


type ArtifactMetaType = {
    lastAccess: Date;
    size: number;
}

export interface TezlandDB extends DBSchema {
    placeMetadata: {
        key: [number, string];
        value: PlaceTokenMetadata;
    };
    placeItems: {
        key: [number, string];
        value: PlaceData;
    };
    itemMetadata: {
        key: number;
        value: ItemTokenMetadata;
    };
    worldGrid: {
        key: string;
        value: WorldGridCell;
    };
    artifactCache: {
        key: string;
        value: ArrayBuffer;
    };
    artifactMeta: {
        key: string;
        value: ArtifactMetaType;
        indexes: { lastAccess: Date, size: number };
    };
}

/**
 * Interface for browser storage providers

 */
 export interface IStorageProvider {
    /**
     * Open an offline support and make it available
     * @param successCallback defines the callback to call on success
     * @param errorCallback defines the callback to call on error
     */
    open(): Promise<void>;

    /**
     * Load an object from storage.
     * @param key defines the key to load from.
     * @param table the table to store the object in.
     */
    loadObject<Name extends StoreNames<TezlandDB>>(table: Name, key: StoreKey<TezlandDB, Name>): Promise<StoreValue<TezlandDB, Name> | undefined>;

    /**
     * Save an object to storage.
     * @param key defines the key to save to.
     * @param table the table to store the object in.
     * @param data the object to save.
     */
    saveObject<Name extends StoreNames<TezlandDB>>(table: Name, data: StoreValue<TezlandDB, Name>, key?: StoreKey<TezlandDB, Name>): Promise<StoreKey<TezlandDB, Name> | undefined>;
}
