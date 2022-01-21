import { Nullable } from "@babylonjs/core";
import { Logging } from "../utils/Logging";
import { IStorageProvider } from "./IStorageProvider";

export class DatabaseStorage implements IStorageProvider {
    private idbFactory = <IDBFactory>(typeof window !== "undefined" ? window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB : indexedDB);
    private isSupported?: boolean;
    private db: Nullable<IDBDatabase>;

    constructor() {
        this.db = null;
    }

    /**
     * Open an offline support and make it available
     * @param successCallback defines the callback to call on success
     * @param errorCallback defines the callback to call on error
     */
     open(successCallback: () => void, errorCallback: () => void): void {
        let handleError = () => {
            this.isSupported = false;
            if (errorCallback) {
                errorCallback();
            }
        };

        if (!this.idbFactory) {
            // Your browser doesn't support IndexedDB
            this.isSupported = false;
            if (errorCallback) {
                errorCallback();
            }
        } else {
            // If the DB hasn't been opened or created yet
            if (!this.db) {
                //this._hasReachedQuota = false;
                this.isSupported = true;

                var request: IDBOpenDBRequest = this.idbFactory.open("tezland", 1);

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
                    this.db = (<any>event.target).result;
                    if (this.db) {
                        try {
                            this.db.createObjectStore("scenes", { keyPath: "sceneUrl" });
                            this.db.createObjectStore("versions", { keyPath: "sceneUrl" });
                            this.db.createObjectStore("textures", { keyPath: "textureUrl" });
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
    loadObject(key: string, table: string): any {
        throw new Error("not implemented");
    }

    /**
     * Save an object to storage.
     * @param url defines the key to save to.
     * @param table the table to store the object in.
     * @param data the object to save.
     */
    saveObject(key: string, table: string, data: any): void {

    }
}