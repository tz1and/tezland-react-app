import { Logging } from "./utils/Logging";

function getEnvVar(key: string): string {
    const val = process.env[key];
    if (val !== undefined) return val;

    Logging.WarnDev('Env var not set: ', key);
    return '';
}

export default class Conf {
    public static public_url: string = getEnvVar('PUBLIC_URL');
    public static app_version: string = getEnvVar('REACT_APP_VERSION');

    public static allowed_tezos_nodes: string[] = getEnvVar('REACT_APP_ALLOWED_TEZOS_NODES').split(' ');
    public static tezos_network: string = getEnvVar('REACT_APP_TEZOS_NETWORK');
    public static ipfs_native_gateway: string = getEnvVar('REACT_APP_IPFS_NATIVE_GATEWAY');
    public static ipfs_public_gateways: string[] = getEnvVar('REACT_APP_IPFS_PUBLIC_GATEWAYS').split(' ');
    public static hasura_url: string = getEnvVar('REACT_APP_HASURA_URL');
    public static backend_url: string = getEnvVar('REACT_APP_BACKEND');
    public static multiplayer_url: string = getEnvVar('REACT_APP_MULTIPLAYER');

    public static item_contract: string = getEnvVar('REACT_APP_ITEM_CONTRACT');
    public static place_contract: string = getEnvVar('REACT_APP_PLACE_CONTRACT');
    public static world_contract: string = getEnvVar('REACT_APP_WORLD_CONTRACT');
    public static minter_contract: string = getEnvVar('REACT_APP_MINTER_CONTRACT');
    public static dutch_auction_contract: string = getEnvVar('REACT_APP_DUTCH_AUCTION_CONTRACT');
    public static interiors_contract: string = getEnvVar('REACT_APP_INTERIORS_CONTRACT');
    public static world_interiors_contract: string = getEnvVar('REACT_APP_WORLD_INTERIORS_CONTRACT');

    public static fees_address: string = "tz1UZFB9kGauB6F5c2gfJo4hVcvrD8MeJ3Vf";

    public static randomPublicIpfsGateway(): string {
        return this.ipfs_public_gateways[Math.floor(Math.random() * this.ipfs_public_gateways.length)];
    }
}