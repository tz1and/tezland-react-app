import { Nullable } from "@babylonjs/core";
import { Logging } from "../utils/Logging";
import { IStorageProvider } from "./IStorageProvider";

const databaseTables: string[] = [
    "placeMetadata",
    "placeItems",
    "placeSeq",
    "itemMetadata",
    "itemPolycount"
]

const databaseVersion = databaseTables.length;

export class DatabaseStorage implements IStorageProvider {
    public isSupported: boolean;
    private hasReachedQuota: boolean;
    private idbFactory: IDBFactory;
    private db: Nullable<IDBDatabase>;

    constructor() {
        this.db = null;
        this.idbFactory = (typeof window !== "undefined" ? window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB : indexedDB);
        this.hasReachedQuota = false;

        if (!this.idbFactory) {
            // Your browser doesn't support IndexedDB
            this.isSupported = false;
        }
        else this.isSupported = true;
    }

    /**
     * Open an offline support and make it available
     * @param successCallback defines the callback to call on success
     * @param errorCallback defines the callback to call on error
     */
     open(successCallback: () => void, errorCallback: () => void): void {
        let handleError = () => {
            if (errorCallback) {
                errorCallback();
            }
        };

        if(!this.isSupported) {
            handleError();
        }
        else {
            // If the DB hasn't been opened or created yet
            if (!this.db) {
                //this._hasReachedQuota = false;
                this.isSupported = true;

                var request: IDBOpenDBRequest = this.idbFactory.open("tezland", databaseVersion);

                // Could occur if user is blocking the quota for the DB and/or doesn't grant access to IndexedDB
                request.onerror = () => {
                    handleError();
                };

                // executes when a version change transaction cannot complete due to other active transactions
                request.onblocked = () => {
                    Logging.Error("IDB request blocked. Please reload the page.");
                    handleError();
                };

                // DB has been opened successfully
                request.onsuccess = () => {
                    this.db = request.result;
                    successCallback();
                };

                // Initialization of the DB. Creating Scenes & Textures stores
                request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                    this.db = (event.target as any).result;
                    if (this.db) {
                        try {
                            for(const table of databaseTables) {
                                if(!this.db.objectStoreNames.contains(table))
                                    this.db.createObjectStore(table); //, { keyPath: "key" });
                            }
                        } catch (ex: any) {
                            Logging.Error("Error while creating object stores. Exception: " + ex.message);
                            handleError();
                        }
                    }
                };
            }
            // DB has already been created and opened
            else {
                if (successCallback) {
                    successCallback();
                }
            }
        }
    }

    /**
     * Load an object from storage.
     * @param url defines the key to load from.
     * @param table the table to store the object in.
     */
    loadObject(key: number, table: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this.isSupported && this.db) {
                var object: any;
                try {
                    var transaction = this.db.transaction([table]);

                    transaction.oncomplete = () => {
                        if (object) {
                            resolve(object);
                        }
                        // not found in db
                        else {
                            resolve(null);
                        }
                    };

                    transaction.onabort = () => {
                        reject();
                    };

                    var getRequest = transaction.objectStore(table).get(key);

                    getRequest.onsuccess = (event) => {
                        object = (event.target as any).result;
                    };
                    getRequest.onerror = () => {
                        Logging.Error("Error loading " + key + " from table " + table + " from DB.");
                        reject();
                    };
                } catch (ex: any) {
                    Logging.Error(`Error while accessing '${table}' object store (READ OP). Exception: ` + ex.message);
                    reject();
                }
            } else {
                Logging.Error("DatabaseStorage not supported");
                reject();
            }
        });
    }

    /**
     * Save an object to storage.
     * @param url defines the key to save to.
     * @param table the table to store the object in.
     * @param data the object to save.
     */
    saveObject(key: number, table: string, data: any): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isSupported && !this.hasReachedQuota && this.db) {
                try {
                    // Open a transaction to the database
                    var transaction = this.db.transaction([table], "readwrite");

                    // the transaction could abort because of a QuotaExceededError error
                    transaction.onabort = (event) => {
                        try {
                            //backwards compatibility with ts 1.0, srcElement doesn't have an "error" according to ts 1.3
                            var error = (event.srcElement as any)["error"];
                            if (error && error.name === "QuotaExceededError") {
                                this.hasReachedQuota = true;
                            }
                        } catch (ex) { }
                        reject();
                    };

                    transaction.oncomplete = () => {
                        resolve();
                    };

                    // Put the scene into the database
                    var addRequest = transaction.objectStore(table).put(data, key);
                    addRequest.onsuccess = () => { };
                    addRequest.onerror = () => {
                        Logging.Error("Error in DB saveObject request in DatabaseStorage.");
                        reject();
                    };
                } catch (ex: any) {
                    Logging.Error(`Error while accessing '${table}' object store (WRITE OP). Exception: ` + ex.message);
                    reject();
                }
            } else {
                Logging.Error("DatabaseStorage not supported");
                reject();
            }
        });
    }
}