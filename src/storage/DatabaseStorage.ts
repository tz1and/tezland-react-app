import { Logging } from "../utils/Logging";
import { IStorageProvider, StorageKeyType } from "./IStorageProvider";
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Nullable } from "@babylonjs/core";

const databaseTables: string[] = [
    "placeMetadata",
    "placeItems",
    "itemMetadata",
    "worldGrid"
]

const databaseVersion = 8;

export class DatabaseStorage implements IStorageProvider {
    private db: Nullable<IDBPDatabase>;

    constructor() {
        this.db = null;
    }

    static isSupported(): boolean {
        const idbFactory = (typeof window !== "undefined" ? window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB : indexedDB);
        if (!idbFactory) return false;
        else return true;
    }

    /**
     * Open DB and return promise
     * @param successCallback defines the callback to call on success
     * @param errorCallback defines the callback to call on error
     */
    async open(): Promise<void> {
        if (!this.db) {
            this.db = await openDB("tezland", databaseVersion, {
                upgrade(db, oldVersion, newVersion, transaction) {
                    try {
                        // add tables that don't exist
                        for (const table of databaseTables) {
                            if(!db.objectStoreNames.contains(table))
                                db.createObjectStore(table); //, { keyPath: "key" });
                        }

                        // remove tables that shouldn't exist
                        for (const table of db.objectStoreNames) {
                            if(databaseTables.indexOf(table) === -1)
                                db.deleteObjectStore(table);
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
    async loadObject(key: StorageKeyType, table: string): Promise<any> {
        return this.db!.get(table, key);
    }

    /**
     * Save an object to storage.
     * @param url defines the key to save to.
     * @param table the table to store the object in.
     * @param data the object to save.
     */
    async saveObject(key: StorageKeyType, table: string, data: any): Promise<IDBValidKey> {
        return this.db!.put(table, data, key);
    }
}