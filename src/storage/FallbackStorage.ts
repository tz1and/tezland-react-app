import { IStorageProvider } from "./IStorageProvider";

interface IStorage {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
}

/**
 * Class for storing data to local storage if available or in-memory storage otherwise
 */
export class FallbackStorage implements IStorageProvider {
    private storage: IStorage;

    constructor() {
        try {
            localStorage.setItem("test", "");
            localStorage.removeItem("test");
            this.storage = localStorage;
        }
        catch {
            const inMemoryStorage: { [key: string]: string } = {};
            this.storage = {
                getItem: (key) => {
                    const value = inMemoryStorage[key];
                    return value === undefined ? null : value;
                },
                setItem: (key, value) => {
                    inMemoryStorage[key] = value;
                }
            };
        }
    }

    /**
     * Open an offline support and make it available
     * @param successCallback defines the callback to call on success
     * @param errorCallback defines the callback to call on error
     */
    open(successCallback: () => void, errorCallback: () => void): void {
        // will always succeed.
        successCallback();
    }

    /**
     * Load an object from storage.
     * @param url defines the key to load from.
     * @param table the table to store the object in.
     * @returns the fetched object or null
     */
    loadObject(key: string, table: string): any {
        const value = this.storage.getItem(table + key);
        if (value === null) return null;
        return JSON.parse(value);
    }
 
    /**
     * Save an object to storage.
     * @param url defines the key to save to.
     * @param table the table to store the object in.
     * @param data the object to save.
     */
    saveObject(key: string, table: string, data: any): void {
        this.storage.setItem(table + key, JSON.stringify(data));
    }

    //public static ReadString(key: string, defaultValue: string): string {
    //    const value = this._Storage.getItem(key);
    //    return (value !== null ? value : defaultValue);
    //}

    //public static WriteString(key: string, value: string): void {
    //    this._Storage.setItem(key, value);
    //}
}
