import axios from "axios";
import Conf from "../Config";
import { DatabaseStorage, FallbackStorage, IStorageProvider } from "../storage";
import { Logging } from "../utils/Logging";

export default class Metadata {
    public static Storage: IStorageProvider = Metadata.GetStorageProvider();

    private static GetStorageProvider(): IStorageProvider {
        const dbstorage = new DatabaseStorage();
        if(!dbstorage.isSupported)
            return new FallbackStorage();
        else {
            dbstorage.open(() => {
                Logging.InfoDev("Opened Database storage");
            }, () => {
                Logging.Error("Failed to open database storage");
            });
            return dbstorage;
        }
    }

    private static async getMetadata(table: string, token_id: number, contract: string): Promise<any> {
        // Try to read the token metadata from storage.
        let tokenMetadata = await Metadata.Storage.loadObject(token_id, table);

        // load from bcdhub if it doesn't exist
        if(!tokenMetadata) {
            Logging.InfoDev("token metadata not known, reading from chain bcdhub");

            // todo: use fetch?
            const responseP = await axios.get(`${Conf.bcd_url}/v1/tokens/${Conf.tezos_network}/metadata?contract=${contract}&token_id=${token_id}`);
            const tokenInfo = responseP.data[0];

            if(!tokenInfo) return undefined;

            // TODO: await store?
            Metadata.Storage.saveObject(token_id, table, tokenInfo);
            tokenMetadata = tokenInfo;
        }

        return tokenMetadata;
    }

    public static async getPlaceMetadata(place_id: number): Promise<any> {
        return Metadata.getMetadata("placeMetadata", place_id, Conf.place_contract);
    }

    public static async getItemMetadata(item_id: number): Promise<any> {
        return Metadata.getMetadata("itemMetadata", item_id, Conf.item_contract);
    }
}