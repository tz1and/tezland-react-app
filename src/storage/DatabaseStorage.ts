import { Logging } from "../utils/Logging";
import { IStorageProvider, StorageKeyType } from "./IStorageProvider";
import { openDB, DBSchema, IDBPDatabase, StoreNames } from 'idb';
import { Nullable } from "@babylonjs/core";
import assert from "assert";

const databaseVersion = 9;

type ArtifactMetaType = {
    lastAccess: Date;
    size: number;
}

interface TezlandDB extends DBSchema {
    placeMetadata: {
        key: number;
        value: any;
    };
    placeItems: {
        key: number;
        value: any;
    };
    itemMetadata: {
        key: number;
        value: any;
    };
    worldGrid: {
        key: string;
        value: any;
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

export class DatabaseStorage implements IStorageProvider {
    private _db: Nullable<IDBPDatabase<TezlandDB>>;

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
     * @param successCallback defines the callback to call on success
     * @param errorCallback defines the callback to call on error
     */
    async open(): Promise<void> {
        if (!this._db) {
            this._db = await openDB<TezlandDB>("tezland", databaseVersion, {
                upgrade(db, oldVersion, newVersion, transaction) {
                    try {
                        // Upgrade from before artifact cache and using idb package.
                        if (oldVersion < 9) {
                            const untypedDb = db as unknown as IDBPDatabase;

                            // Remove all old tables.
                            for (const table of untypedDb.objectStoreNames) {
                                untypedDb.deleteObjectStore(table);
                            }

                            db.createObjectStore("placeMetadata");
                            db.createObjectStore("placeItems");
                            db.createObjectStore("itemMetadata");
                            db.createObjectStore("worldGrid");
                            db.createObjectStore("artifactCache");

                            const artifactCache = db.createObjectStore("artifactMeta");
                            artifactCache.createIndex("lastAccess", "lastAccess");
                            artifactCache.createIndex("size", "size");
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

    /**
     * Load an object from storage.
     * @param url defines the key to load from.
     * @param table the table to store the object in.
     */
    async loadObject(key: StorageKeyType, table: StoreNames<TezlandDB>): Promise<any> {
        assert(this._db);
        const tx = this._db.transaction(table, "readonly", { durability: "relaxed" })
        return tx.store.get(key);
    }

    /**
     * Save an object to storage.
     * @param url defines the key to save to.
     * @param table the table to store the object in.
     * @param data the object to save.
     */
    async saveObject(key: StorageKeyType, table: StoreNames<TezlandDB>, data: any): Promise<IDBValidKey> {
        assert(this._db);
        const tx = this._db.transaction(table, "readwrite", { durability: "relaxed" })
        return tx.store.put(data, key);
    }
}