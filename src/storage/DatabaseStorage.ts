import { Logging } from "../utils/Logging";
import { IStorageProvider, TezlandDB } from "./IStorageProvider";
import { openDB, IDBPDatabase, StoreNames, StoreValue, StoreKey } from 'idb';
import assert from "assert";


const databaseVersion = 14;

export class DatabaseStorage implements IStorageProvider {
    private _db: IDBPDatabase<TezlandDB> | null;

    constructor() {
        this._db = null;
    }

    static isSupported(): boolean {
        const idbFactory = (typeof window !== "undefined" ? window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB : indexedDB);
        if (!idbFactory) return false;
        else return true;
    }

    public get db(): IDBPDatabase<TezlandDB> {
        assert(this._db);
        return this._db;
    }

    /**
     * Open DB and return promise
     */
    async open(): Promise<void> {
        if (!this._db) {
            this._db = await openDB<TezlandDB>("tezland", databaseVersion, {
                upgrade(db, oldVersion, newVersion, transaction) {
                    try {
                        // Upgrade from before artifact cache and using idb package.
                        if (oldVersion < 11) {
                            const untypedDb = db as unknown as IDBPDatabase;

                            // Remove all old tables.
                            for (const table of untypedDb.objectStoreNames) {
                                untypedDb.deleteObjectStore(table);
                            }

                            db.createObjectStore("placeMetadata");
                            //db.createObjectStore("placeItems");
                            //db.createObjectStore("itemMetadata");
                            db.createObjectStore("worldGrid");
                            db.createObjectStore("artifactCache");

                            const artifactCache = db.createObjectStore("artifactMeta");
                            artifactCache.createIndex("lastAccess", "lastAccess");
                            artifactCache.createIndex("size", "size");
                        }
                        
                        if (oldVersion < 13) {
                            // Need to clear metadata tables and world grid
                            if (db.objectStoreNames.contains("placeMetadata")) db.deleteObjectStore("placeMetadata");
                            //if (db.objectStoreNames.contains("placeItems")) db.deleteObjectStore("placeItems");
                            if (db.objectStoreNames.contains("itemMetadata")) db.deleteObjectStore("itemMetadata");
                            if (db.objectStoreNames.contains("worldGrid")) db.deleteObjectStore("worldGrid");

                            //db.createObjectStore("placeMetadata", { keyPath: ['tokenId', 'placeType'] });
                            //db.createObjectStore("placeItems", { keyPath: ['tokenId', 'placeType'] });
                            //db.createObjectStore("itemMetadata", { keyPath: 'tokenId' });
                            db.createObjectStore("worldGrid");
                        }

                        if (oldVersion < 14) {
                            // Need to clear old metadata and place items tables.
                            {
                                const untypedDb = db as unknown as IDBPDatabase;
                                if (untypedDb.objectStoreNames.contains("placeMetadata")) untypedDb.deleteObjectStore("placeMetadata");
                                if (untypedDb.objectStoreNames.contains("placeItems")) untypedDb.deleteObjectStore("placeItems");
                                if (untypedDb.objectStoreNames.contains("itemMetadata")) untypedDb.deleteObjectStore("itemMetadata");
                            }

                            db.createObjectStore("itemMetadata", { keyPath: ['tokenId', 'contract'] });
                            db.createObjectStore("placeMetadata", { keyPath: ['tokenId', 'contract'] });
                            db.createObjectStore("placeData", { keyPath: ['tokenId', 'contract'] });
                            db.createObjectStore("placeChunks", { keyPath: ['tokenId', 'contract', "chunkId"] });
                        }
                    } catch (ex: any) {
                        Logging.Error("Error while creating object stores. Exception: " + ex.message);
                        throw ex;
                    }
                },
                blocked() {
                    Logging.Error("IDB request blocked. Please reload the page.");
                },
                blocking() {
                    Logging.Error("IDB request blocked. Please reload the page.");
                },
                terminated() {
                    Logging.Error("IDB connection terminated. Please reload the page.");
                },
            });
        }

        return Promise.resolve();
    }

    // TODO: maybe should never assert in the db interface?

    /**
     * Load an object from storage.
     * @param key defines the key to load from.
     * @param table the table to store the object in.
     */
    loadObject<Name extends StoreNames<TezlandDB>>(table: Name, key: StoreKey<TezlandDB, Name>): Promise<StoreValue<TezlandDB, Name> | undefined> {
        assert(this._db);
        const tx = this._db.transaction(table, "readonly", { durability: "relaxed" });
        return tx.store.get(key);
    }

    /**
     * Save an object to storage.
     * @param key defines the key to save to.
     * @param table the table to store the object in.
     * @param data the object to save.
     */
    saveObject<Name extends StoreNames<TezlandDB>>(table: Name, data: StoreValue<TezlandDB, Name>, key?: StoreKey<TezlandDB, Name>): Promise<StoreKey<TezlandDB, Name>> {
        assert(this._db);
        const tx = this._db.transaction(table, "readwrite", { durability: "relaxed" });
        return tx.store.put(data, key);
    }
}