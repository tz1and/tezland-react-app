// @ts-nocheck
export default class Conf {
    public static tezos_node: string = process.env.REACT_APP_TEZOS_NODE;
    public static bcd_url: string = process.env.REACT_APP_BCD_URL;
    public static ipfs_url: string = process.env.REACT_APP_IPFS_URL;
    public static hasura_url: string = process.env.REACT_APP_HASURA_URL;
    public static tezos_network: string = process.env.REACT_APP_TEZOS_NETWORK;

    public static item_contract: string = process.env.REACT_APP_ITEM_CONTRACT;
    public static place_contract: string = process.env.REACT_APP_PLACE_CONTRACT;
    public static marketplaces_contract: string = process.env.REACT_APP_MARKETPLACES_CONTRACT;
    public static minter_contract: string = process.env.REACT_APP_MINTER_CONTRACT;
    public static dutch_auchtion_contract: string = process.env.REACT_APP_DUTCH_AUCTION_CONTRACT;

    public static polycount_limit: number = parseInt(process.env.REACT_APP_POLYCOUNT_LIMIT);
}