import { IStorageProvider, StorageKeyType } from "./IStorageProvider";

interface IStorage {
    getItem: (key: string) => string | undefined;
    setItem: (key: string, value: string) => void;
}

/**
 * Class for storing data to local storage if available or in-memory storage otherwise
 */
export class FallbackStorage implements IStorageProvider {
    private storage: IStorage;

    constructor() {
        const inMemoryStorage: { [key: string]: string } = {};
        this.storage = {
            getItem: (key) => {
                return inMemoryStorage[key];
            },
            setItem: (key, value) => {
                inMemoryStorage[key] = value;
            }
        };
    }

    /**
     * Open an offline support and make it available
     * @param successCallback defines the callback to call on success
     * @param errorCallback defines the callback to call on error
     */
    open(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Load an object from storage.
     * @param url defines the key to load from.
     * @param table the table to store the object in.
     * @returns the fetched object or null
     */
    loadObject(key: StorageKeyType, table: string): Promise<any | undefined> {
        return new Promise((resolve) => {
            const value = this.storage.getItem(table + key);
            if (value === undefined) resolve(undefined);
            else resolve(JSON.parse(value));
        })
    }
 
    /**
     * Save an object to storage.
     * @param url defines the key to save to.
     * @param table the table to store the object in.
     * @param data the object to save.
     */
    saveObject(key: StorageKeyType, table: string, data: any): Promise<IDBValidKey> {
        return new Promise((resolve) => {
            this.storage.setItem(table + key, JSON.stringify(data));
            resolve(key);
        });
    }

    //public static ReadString(key: string, defaultValue: string): string {
    //    const value = this._Storage.getItem(key);
    //    return (value !== null ? value : defaultValue);
    //}

    //public static WriteString(key: string, value: string): void {
    //    this._Storage.setItem(key, value);
    //}
}
