import { DataStorage } from "@babylonjs/core";
import axios from "axios";
import Conf from "../Config";
import { isDev } from "../tz/Utils";

export default class Metadata {

    private static async getMetadata(key: string, token_id: number, contract: string) {
        // Try to read the token metadata from storage.
        let tokenMetadata = JSON.parse(DataStorage.ReadString(key, "{}"));

        // load from bcdhub if it doesn't exist
        if(Object.keys(tokenMetadata).length === 0) {
            if(isDev()) console.log("token metadata not known, reading from chain bcdhub");

            const responseP = await axios.get(`${Conf.bcd_url}/v1/tokens/${Conf.tezos_network}/metadata?contract=${contract}&token_id=${token_id}`);
            const tokenInfo = responseP.data[0];

            if(!tokenInfo) return undefined;

            DataStorage.WriteString(key, JSON.stringify(tokenInfo));
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