import { deleteDB } from "idb";
import { fetchGraphQL } from "../ipfs/graphql";
import { DatabaseStorage, FallbackStorage, IStorageProvider } from "../storage";
import { Logging } from "../utils/Logging";

export enum StorageKey {
    PlaceMetadata = "placeMetadata",
    ItemMetadata = "itemMetadata",
    PlaceItems = "placeItems"
  }

export default class Metadata {
    public static Storage: IStorageProvider = new FallbackStorage();

    public static async InitialiseStorage() {
        if(DatabaseStorage.isSupported()) {
            const dbStorage = new DatabaseStorage();
            await dbStorage.open();
            Metadata.Storage = dbStorage;

            // remove babylonjs db if it exists
            await Metadata.deleteBabylonJsDb();
        }
    }

    private static async deleteBabylonJsDb() {
        try {
            const babylonDbName = "babylonjs";
            let babylonDbExists = false;

            // Check if it exists.
            const databases = await indexedDB.databases();
            for (const db of databases) {
                if (db.name === babylonDbName) {
                    babylonDbExists = true;
                    break;
                }
            }

            // Remove if it exists.
            if (babylonDbExists) {
                await deleteDB(babylonDbName);
                Logging.Info("Deleted babylonjs database.");
            }
        }
        catch (e: any) {
            Logging.Warn("Failed to delete babylonjs database:", e.message);
        }
    }

    public static async getPlaceMetadataBatch(places: number[]) {
        const place_metadatas = [];
        const places_to_fetch = [];

        for (const place_id of places) {
            // Try to read the token metadata from storage.
            let tokenMetadata = await Metadata.Storage.loadObject(place_id, StorageKey.PlaceMetadata);

            // If it doesn't exist, add to fetch array.
            if(!tokenMetadata) places_to_fetch.push(place_id);
            // else, append
            else place_metadatas.push(tokenMetadata);
        }

        if (places_to_fetch.length === 0) return place_metadatas;

        Logging.Info(`batch fetching ${places_to_fetch.length} places from indexer`);

        const chunk_size = 50;
        for (let i = 0; i < places_to_fetch.length; i += chunk_size) {
            const chunk = places_to_fetch.slice(i, i + chunk_size);

            const data = await fetchGraphQL(`
                query getPlaceTokenMetadataBatch($ids: [bigint!]) {
                    placeTokenMetadata(where: { id: { _in: $ids } }) {
                        id
                        name
                        description
                        borderCoordinates
                        centerCoordinates
                        placeType
                        buildHeight
                        timestamp
                        placeToken {
                            minterId
                        }
                    }
                }`, "getPlaceTokenMetadataBatch", { ids: chunk });

            for (const metadata of data.placeTokenMetadata) {
                // fix up the coordinates
                metadata.borderCoordinates = JSON.parse(metadata.borderCoordinates)
                metadata.centerCoordinates = JSON.parse(metadata.centerCoordinates)
                // set minter
                metadata.minter = metadata.placeToken[0].minterId;
                delete metadata.placeToken;

                Metadata.Storage.saveObject(metadata.id, StorageKey.PlaceMetadata, metadata);
                place_metadatas.push(metadata);
            }
        }

        return place_metadatas;
    }

    public static async getPlaceMetadata(token_id: number): Promise<any> {
        // Try to read the token metadata from storage.
        let tokenMetadata = await Metadata.Storage.loadObject(token_id, StorageKey.PlaceMetadata);

        // load from indexer if it doesn't exist
        if(!tokenMetadata) {
            Logging.InfoDev("token metadata not known, reading from indexer");

            const data = await fetchGraphQL(`
                query getPlaceTokenMetadata($id: bigint!) {
                    placeTokenMetadata(where: { id: { _eq: $id } }) {
                        id
                        name
                        description
                        borderCoordinates
                        centerCoordinates
                        placeType
                        buildHeight
                        timestamp
                        placeToken {
                            minterId
                        }
                    }
                }`, "getPlaceTokenMetadata", { id: token_id });

            // fix up border and center coords
            const metadata = data.placeTokenMetadata[0];

            // TODO: await store?
            if (metadata) {
                // fix up the coordinates
                metadata.borderCoordinates = JSON.parse(metadata.borderCoordinates)
                metadata.centerCoordinates = JSON.parse(metadata.centerCoordinates)
                // set minter
                metadata.minter = metadata.placeToken[0].minterId;
                delete metadata.placeToken;

                Metadata.Storage.saveObject(metadata.id, StorageKey.PlaceMetadata, metadata);
            }
            tokenMetadata = metadata;
        }

        return tokenMetadata;
    }

    public static async getItemMetadata(token_id: number): Promise<any> {
        // Try to read the token metadata from storage.
        let tokenMetadata = await Metadata.Storage.loadObject(token_id, StorageKey.ItemMetadata);

        // load from indexer if it doesn't exist
        if(!tokenMetadata) {
            Logging.InfoDev("token metadata not known, reading from indexer");

            const data = await fetchGraphQL(`
                query getItemTokenMetadata($id: bigint!) {
                    itemTokenMetadata(where: { id: { _eq: $id } }) {
                        id
                        name
                        description
                        artifactUri
                        displayUri
                        thumbnailUri
                        baseScale
                        fileSize
                        mimeType
                        polygonCount
                        timestamp
                        itemToken {
                            minterId
                        }
                    }
                }`, "getItemTokenMetadata", { id: token_id });

            const metadata = data.itemTokenMetadata[0];

            // TODO: await store?
            if (metadata) {
                // set minter
                metadata.minter = metadata.itemToken[0].minterId;
                delete metadata.itemToken;

                Metadata.Storage.saveObject(token_id, StorageKey.ItemMetadata, metadata);
            }
            tokenMetadata = metadata;
        }

        return tokenMetadata;
    }
}