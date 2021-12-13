// @ts-nocheck
export default class Conf {
    public static tezos_node: string = process.env.BABYLON_APP_TEZOS_NODE;
    public static bcd_url: string = process.env.BABYLON_APP_BCD_URL;
    public static ipfs_url: string = process.env.BABYLON_APP_IPFS_URL;
    public static tezos_network: string = process.env.BABYLON_APP_TEZOS_NETWORK;
    public static dev_account: string = process.env.BABYLON_APP_DEV_ACCOUNT;
    public static item_contract: string = process.env.BABYLON_APP_ITEM_CONTRACT;
    public static place_contract: string = process.env.BABYLON_APP_PLACE_CONTRACT;
    public static marketplaces_contract: string = process.env.BABYLON_APP_MARKETPLACES_CONTRACT;
}