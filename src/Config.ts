import { Logging } from "./utils/Logging";

function getEnvVar(key: string): string {
    const val = import.meta.env[key];
    if (val !== undefined) return val;

    Logging.WarnDev('Env var not set: ', key);
    return '';
}

export default class Conf {
    public static public_url: string = getEnvVar('VITE_PUBLIC_URL');
    public static app_version: string = getEnvVar('VITE_VERSION');

    public static allowed_tezos_nodes: string[] = getEnvVar('VITE_ALLOWED_TEZOS_NODES').split(' ');
    public static tezos_network: string = getEnvVar('VITE_TEZOS_NETWORK');
    public static ipfs_native_gateway: string = getEnvVar('VITE_IPFS_NATIVE_GATEWAY');
    public static ipfs_public_gateways: string[] = getEnvVar('VITE_IPFS_PUBLIC_GATEWAYS').split(' ');
    public static hasura_url: string = getEnvVar('VITE_HASURA_URL');
    public static backend_url: string = getEnvVar('VITE_BACKEND');
    public static multiplayer_url: string = getEnvVar('VITE_MULTIPLAYER');
    //public static multiplayer_mm_url: string = getEnvVar('VITE_MULTIPLAYER_MM');

    public static item_v1_contract: string = getEnvVar('VITE_ITEM_V1_CONTRACT');
    public static item_contract: string = getEnvVar('VITE_ITEM_CONTRACT');
    public static place_v1_contract: string = getEnvVar('VITE_PLACE_V1_CONTRACT');
    public static place_contract: string = getEnvVar('VITE_PLACE_CONTRACT');
    public static world_contract: string = getEnvVar('VITE_WORLD_CONTRACT');
    public static minter_contract: string = getEnvVar('VITE_MINTER_CONTRACT');
    public static dutch_auction_contract: string = getEnvVar('VITE_DUTCH_AUCTION_CONTRACT');
    public static interior_contract: string = getEnvVar('VITE_INTERIOR_CONTRACT');
    public static factory_contract: string = getEnvVar('VITE_FACTORY_CONTRACT');

    public static fees_address: string = "tz1UZFB9kGauB6F5c2gfJo4hVcvrD8MeJ3Vf";

    public static discordInviteLink: string = "https://discord.gg/AAwpbStzZf";

    public static randomPublicIpfsGateway(): string {
        return this.ipfs_public_gateways[Math.floor(Math.random() * this.ipfs_public_gateways.length)];
    }
}