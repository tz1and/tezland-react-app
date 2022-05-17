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
                query getPlaceTokenMetadataBatch($ids: [numeric!]) {
                    place_token_metadata(where: { token_id: { _in: $ids } }) {
                        token_id
                        metadata
                    }
                }`, "getPlaceTokenMetadataBatch", { ids: chunk });

            for (const placeToken of data.place_token_metadata) {
                const metadata = placeToken.metadata;
                if (metadata) {
                    metadata.id = placeToken.token_id;
                    // Probably OK not to await this.
                    Metadata.Storage.saveObject(placeToken.token_id, StorageKey.PlaceMetadata, metadata);
                    place_metadatas.push(metadata);
                }
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
                query getPlaceTokenMetadata($id: numeric!) {
                    place_token_metadata(where: { token_id: { _eq: $id } }) {
                        token_id
                        metadata
                    }
                }`, "getPlaceTokenMetadata", { id: token_id });

            // fix up border and center coords
            const placeToken = data.place_token_metadata[0];
            const metadata = placeToken.metadata;
            // TODO: await store?
            if (metadata) {
                metadata.id = placeToken.token_id;
                // Probably OK not to await this.
                Metadata.Storage.saveObject(token_id, StorageKey.PlaceMetadata, metadata);
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
                query getItemTokenMetadata($id: numeric!) {
                    item_token_metadata(where: { token_id: { _eq: $id } }) {
                        token_id
                        metadata
                    }
                }`, "getItemTokenMetadata", { id: token_id });

            const itemToken = data.item_token_metadata[0];
            const metadata = itemToken.metadata;
            // TODO: we're relying on minter from json to be correct, maybe get from item_token
            // relationship instead and patch it up.
            // TODO: await store?
            if (metadata) {
                metadata.id = itemToken.token_id;
                Metadata.Storage.saveObject(token_id, StorageKey.ItemMetadata, metadata);
            }
            tokenMetadata = metadata;
        }

        return tokenMetadata;
    }
}