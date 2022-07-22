import { deleteDB } from "idb";
import { grapphQLUser } from "../graphql/user";
import { DatabaseStorage, FallbackStorage, IStorageProvider } from "../storage";
import { Logging } from "../utils/Logging";


export type ItemTokenMetadata = {
    tokenId: number;
    name: string;
    description: string;
    artifactUri: string;
    displayUri: string | null;
    thumbnailUri: string | null;
    baseScale: number;
    fileSize: number;
    mimeType: string;
    polygonCount: number;
    timestamp: string;
    minter: string;
}

export type PlaceTokenMetadata = {
    tokenId: number;
    name: string;
    description: string;
    borderCoordinates: number[][];
    centerCoordinates: number[];
    placeType: string;
    buildHeight: number;
    timestamp: string;
    minter: string;
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

    public static async getPlaceMetadataBatch(places: number[]): Promise<PlaceTokenMetadata[]> {
        const place_metadatas: PlaceTokenMetadata[] = [];
        const places_to_fetch: number[] = [];

        // Try to fetch all from storage.
        {
            const metadata_db_promises: Promise<PlaceTokenMetadata | undefined>[] = []
            // Try to read the token metadata from storage.
            for (const place_id of places)
                metadata_db_promises.push(Metadata.Storage.loadObject(place_id, "placeMetadata"));

            (await Promise.allSettled(metadata_db_promises)).forEach((res, index) => {
                // If it doesn't exist, add to fetch array.
                if (res.status === 'rejected' || res.value === undefined)
                    places_to_fetch.push(places[index]);
                // Else, append to metadatae.
                else place_metadatas.push(res.value);
            });
        }

        if (places_to_fetch.length === 0) return place_metadatas;

        Logging.Info(`batch fetching ${places_to_fetch.length} places from indexer`);

        const chunk_size = 50;
        for (let i = 0; i < places_to_fetch.length; i += chunk_size) {
            const chunk = places_to_fetch.slice(i, i + chunk_size);

            const data = await grapphQLUser.getPlaceTokenMetadataBatch({ids: chunk});

            for (const metadata of data.placeTokenMetadata) {
                // fix up the coordinates
                metadata.borderCoordinates = JSON.parse(metadata.borderCoordinates)
                metadata.centerCoordinates = JSON.parse(metadata.centerCoordinates)
                // set minter
                // TODO: this is nasty
                const placeMeta: PlaceTokenMetadata = (metadata as any);
                placeMeta.minter = metadata.placeToken[0].minterId;
                delete (metadata as any).placeToken;

                Metadata.Storage.saveObject(metadata.tokenId, "placeMetadata", placeMeta);
                place_metadatas.push(placeMeta);
            }
        }

        return place_metadatas;
    }

    public static async getPlaceMetadata(token_id: number): Promise<PlaceTokenMetadata | undefined> {
        // Try to read the token metadata from storage.
        let tokenMetadata: PlaceTokenMetadata | undefined = await Metadata.Storage.loadObject(token_id, "placeMetadata");

        // load from indexer if it doesn't exist
        if(!tokenMetadata) {
            Logging.InfoDev("token metadata not known, reading from indexer");

            const data = await grapphQLUser.getPlaceTokenMetadata({id: token_id});

            // fix up border and center coords
            const metadata = data.placeTokenMetadata[0];

            // TODO: await store?
            if (metadata) {
                // fix up the coordinates
                metadata.borderCoordinates = JSON.parse(metadata.borderCoordinates)
                metadata.centerCoordinates = JSON.parse(metadata.centerCoordinates)
                // set minter
                // TODO: this is nasty
                // TODO: don't modify minter???? use it as it comes in from graphql....
                const placeMeta: PlaceTokenMetadata = (metadata as any);
                placeMeta.minter = metadata.placeToken[0].minterId;
                delete (metadata as any).placeToken;

                Metadata.Storage.saveObject(metadata.tokenId, "placeMetadata", placeMeta);
                tokenMetadata = placeMeta;
            }
        }

        return tokenMetadata;
    }

    public static async getItemMetadata(token_id: number): Promise<ItemTokenMetadata | undefined> {
        // Try to read the token metadata from storage.
        let tokenMetadata: ItemTokenMetadata | undefined = await Metadata.Storage.loadObject(token_id, "itemMetadata");

        // load from indexer if it doesn't exist
        if(!tokenMetadata) {
            Logging.InfoDev("token metadata not known, reading from indexer");

            const data = await grapphQLUser.getItemTokenMetadata({id: token_id});

            const metadata = data.itemTokenMetadata[0];

            // TODO: await store?
            if (metadata) {
                // set minter
                // TODO: this is nasty
                const itemMeta: ItemTokenMetadata = (metadata as any);
                itemMeta.minter = metadata.itemToken[0].minterId;
                delete (metadata as any).itemToken;

                Metadata.Storage.saveObject(token_id, "itemMetadata", itemMeta);
                tokenMetadata = itemMeta;
            }
        }

        return tokenMetadata;
    }
}