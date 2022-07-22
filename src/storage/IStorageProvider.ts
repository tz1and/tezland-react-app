import { DBSchema, StoreKey, StoreNames, StoreValue } from "idb";
import { PlaceTokenMetadata, ItemTokenMetadata } from "../world/Metadata";


type ArtifactMetaType = {
    lastAccess: Date;
    size: number;
}

export interface TezlandDB extends DBSchema {
    placeMetadata: {
        key: number;
        value: PlaceTokenMetadata;
    };
    placeItems: {
        key: number;
        value: any; // TODO: PlaceData type
    };
    itemMetadata: {
        key: number;
        value: ItemTokenMetadata;
    };
    worldGrid: {
        key: string;
        value: any; // TODO: WorldGrid type
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
    loadObject<Name extends StoreNames<TezlandDB>>(key: StoreKey<TezlandDB, Name>, table: Name): Promise<StoreValue<TezlandDB, Name> | undefined>;

    /**
     * Save an object to storage.
     * @param key defines the key to save to.
     * @param table the table to store the object in.
     * @param data the object to save.
     */
    saveObject<Name extends StoreNames<TezlandDB>>(key: StoreKey<TezlandDB, Name>, table: Name, data: StoreValue<TezlandDB, Name>): Promise<StoreKey<TezlandDB, Name>>;
}
