import axios from "axios";
import Conf from "../Config";
import { FallbackStorage, IStorageProvider } from "../storage";
import { Logging } from "../utils/Logging";

export default class Metadata {
    private static Storage: IStorageProvider = Metadata.GetStorageProvider();

    private static GetStorageProvider(): IStorageProvider {
        // Just create fallback storage for now.
        return new FallbackStorage();
    }

    private static async getMetadata(key: string, token_id: number, contract: string) {
        // Try to read the token metadata from storage.
        let tokenMetadata = Metadata.Storage.loadObject(key, "");

        // load from bcdhub if it doesn't exist
        if(!tokenMetadata) {
            Logging.InfoDev("token metadata not known, reading from chain bcdhub");

            // todo: use fetch?
            const responseP = await axios.get(`${Conf.bcd_url}/v1/tokens/${Conf.tezos_network}/metadata?contract=${contract}&token_id=${token_id}`);
            const tokenInfo = responseP.data[0];

            if(!tokenInfo) return undefined;

            Metadata.Storage.saveObject(key, "", tokenInfo);
            tokenMetadata = tokenInfo;
        }

        return tokenMetadata;
    }

    public static async getPlaceMetadata(place_id: number) {
        const stMetaKey = "placeMeta" + place_id;

        return Metadata.getMetadata(stMetaKey, place_id, Conf.place_contract);
    }

    public static async getItemMetadata(item_id: number) {
        const stMetaKey = "itemMeta" + item_id;

        return Metadata.getMetadata(stMetaKey, item_id, Conf.item_contract);
    }
}