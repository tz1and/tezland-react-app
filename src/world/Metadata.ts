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
                query getPlaceTokenMetadataBatch($ids: [bigint!]) {
                    placeToken(where: { id: { _in: $ids } }) {
                        id
                        name
                        description
                        placeType
                        buildHeight
                        borderCoordinates
                        centerCoordinates
                        thumbnailUri
                        minterId
                    }
                }`, "getPlaceTokenMetadataBatch", { ids: chunk });

            for (const placeToken of data.placeToken) {
                // fix up border and center coords
                placeToken.borderCoordinates = JSON.parse(placeToken.borderCoordinates);
                placeToken.centerCoordinates = JSON.parse(placeToken.centerCoordinates);

                await Metadata.Storage.saveObject(placeToken.id, "placeMetadata", placeToken);
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
                query getPlaceTokenMetadata($id: bigint!) {
                    placeToken(where: { id: { _eq: $id } }) {
                        id
                        name
                        description
                        placeType
                        buildHeight
                        borderCoordinates
                        centerCoordinates
                        thumbnailUri
                        minterId
                    }
                }`, "getPlaceTokenMetadata", { id: token_id });

            // fix up border and center coords
            const placeToken = data.placeToken[0];
            placeToken.borderCoordinates = JSON.parse(placeToken.borderCoordinates);
            placeToken.centerCoordinates = JSON.parse(placeToken.centerCoordinates);

            // TODO: await store?
            Metadata.Storage.saveObject(token_id, "placeMetadata", placeToken);
            tokenMetadata = placeToken;
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
                query getItemTokenMetadata($id: bigint!) {
                    itemToken(where: { id: { _eq: $id } }) {
                        id
                        name
                        description
                        thumbnailUri
                        artifactUri
                        minterId
                        mimeType
                        fileSize
                        royalties
                        supply
                        baseScale
                        polygonCount
                    }
                }`, "getItemTokenMetadata", { id: token_id });

            // TODO: await store?
            Metadata.Storage.saveObject(token_id, "itemMetadata", data.itemToken[0]);
            tokenMetadata = data.itemToken[0];
        }

        return tokenMetadata;
    }
}