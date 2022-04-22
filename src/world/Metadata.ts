import { fetchGraphQL } from "../ipfs/graphql";
import { DatabaseStorage, FallbackStorage, IStorageProvider } from "../storage";
import { Logging } from "../utils/Logging";

export default class Metadata {
    public static Storage: IStorageProvider = Metadata.GetStorageProvider();

    private static GetStorageProvider(): IStorageProvider {
        const dbstorage = new DatabaseStorage();
        if(!dbstorage.isSupported)
            return new FallbackStorage();
        else return dbstorage;
            // OLD: this is done in index.tsx now.
            /*{
            dbstorage.open(() => {
                Logging.InfoDev("Opened Database storage");
            }, () => {
                Logging.Error("Failed to open database storage");
            });
            return dbstorage;*/
    }

    public static async getPlaceMetadataBatch(token_id_start: number, token_id_end: number) {
        const places_to_fetch = [];

        for (let token_id = token_id_start; token_id <= token_id_end; ++token_id) {
            // Try to read the token metadata from storage.
            let tokenMetadata = await Metadata.Storage.loadObject(token_id, "placeMetadata");

            // If it doesn't exist, add to fetch array.
            if(!tokenMetadata) places_to_fetch.push(token_id);
        }

        if (places_to_fetch.length === 0) return;

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
                    await Metadata.Storage.saveObject(placeToken.token_id, "placeMetadata", metadata);
                }
            }
        }
    }

    public static async getPlaceMetadata(token_id: number): Promise<any> {
        // Try to read the token metadata from storage.
        let tokenMetadata = await Metadata.Storage.loadObject(token_id, "placeMetadata");

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
                Metadata.Storage.saveObject(token_id, "placeMetadata", metadata);
            }
            tokenMetadata = metadata;
        }

        return tokenMetadata;
    }

    public static async getItemMetadata(token_id: number): Promise<any> {
        // Try to read the token metadata from storage.
        let tokenMetadata = await Metadata.Storage.loadObject(token_id, "itemMetadata");

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
                Metadata.Storage.saveObject(token_id, "itemMetadata", metadata);
            }
            tokenMetadata = metadata;
        }

        return tokenMetadata;
    }
}