// @ts-nocheck
export default class Conf {
    public static public_url: string = process.env.PUBLIC_URL;
    public static app_version: string = process.env.REACT_APP_VERSION;

    public static allowed_tezos_nodes: string[] = process.env.REACT_APP_ALLOWED_TEZOS_NODES.split(' ');
    public static tezos_network: string = process.env.REACT_APP_TEZOS_NETWORK;
    public static ipfs_gateways: string[] = process.env.REACT_APP_IPFS_GATEWAYS.split(' ');
    public static hasura_url: string = process.env.REACT_APP_HASURA_URL;
    public static backend_url: string = process.env.REACT_APP_BACKEND;
    public static multiplayer_url: string = process.env.REACT_APP_MULTIPLAYER;

    public static item_contract: string = process.env.REACT_APP_ITEM_CONTRACT;
    public static place_contract: string = process.env.REACT_APP_PLACE_CONTRACT;
    public static world_contract: string = process.env.REACT_APP_WORLD_CONTRACT;
    public static minter_contract: string = process.env.REACT_APP_MINTER_CONTRACT;
    public static dutch_auction_contract: string = process.env.REACT_APP_DUTCH_AUCTION_CONTRACT;

    public static fees_address: string = "tz1UZFB9kGauB6F5c2gfJo4hVcvrD8MeJ3Vf";

    public static randomIpfsGateway(): string {
        return this.ipfs_gateways[Math.floor(Math.random() * this.ipfs_gateways.length)];
    }
}