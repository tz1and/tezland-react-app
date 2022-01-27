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

    public static async getPlaceMetadata(token_id: number): Promise<any> {
        // Try to read the token metadata from storage.
        let tokenMetadata = await Metadata.Storage.loadObject(token_id, "placeMetadata");

        // load from bcdhub if it doesn't exist
        if(!tokenMetadata) {
            Logging.InfoDev("token metadata not known, reading from indexer");

            const data = await fetchGraphQL(`
                query getPlaceTokenMetadata($id: bigint!) {
                    placeToken(where: { id: { _eq: $id } }) {
                        id
                        name
                        description
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

        // load from bcdhub if it doesn't exist
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
                        royalties
                        supply
                    }
                }`, "getItemTokenMetadata", { id: token_id });

            // TODO: await store?
            Metadata.Storage.saveObject(token_id, "itemMetadata", data.itemToken[0]);
            tokenMetadata = data.itemToken[0];
        }

        return tokenMetadata;
    }
}