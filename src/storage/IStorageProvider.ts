
export type StorageKeyType = number | string;

/**
 * Interface for browser storage providers

 */
 export interface IStorageProvider {
    /**
     * Open an offline support and make it available
     * @param successCallback defines the callback to call on success
     * @param errorCallback defines the callback to call on error
     */
    open(successCallback: () => void, errorCallback: () => void): void;

    /**
     * Load an object from storage.
     * @param url defines the key to load from.
     * @param table the table to store the object in.
     */
    loadObject(key: StorageKeyType, table: string): Promise<any>;

    /**
     * Save an object to storage.
     * @param url defines the key to save to.
     * @param table the table to store the object in.
     * @param data the object to save.
     */
    saveObject(key: StorageKeyType, table: string, data: any): Promise<void>;
}