import { createContext, useContext } from "react";
import { TezosToolkit } from "@taquito/taquito";
import { RpcClient, RpcClientCache } from '@taquito/rpc';
import { BeaconWallet } from '@taquito/beacon-wallet';
import { NetworkType, DAppClientOptions/*, BeaconEvent*/ } from '@airgap/beacon-dapp';
import Conf from "../Config";
import { isDev } from "../utils/Utils";
import EventEmitter from "events";
import AppSettings from "../storage/AppSettings";
import Config from "../Config";
import { Logging } from "../utils/Logging";
import { assert } from "../utils/Assert";


export type ITezosWalletProvider = {
    //setWalletAddress(walletAddress: string): void;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    isWalletConnected: () => boolean;
    tezosToolkit: () => TezosToolkit;
    walletPHK: () => string;
    walletEvents: () => EventEmitter;

    addWalletOperation(hash: string): void;
    walletOperationDone(hash: string, completed: boolean, message?: string): void;
}

// For development only.
const useInMemorySigner = false;

class TezosWalletProvider implements ITezosWalletProvider {
    private tezos: TezosToolkit;
    private beaconWallet?: BeaconWallet;
    private walletAddress?: string | undefined;
    private walletEventEmitter: EventEmitter;

    constructor() {
        this.tezos = new TezosToolkit(new RpcClientCache(new RpcClient(TezosWalletProvider.getRpcNode())));
        this.walletEventEmitter = new EventEmitter();
        this.setupWallet();
    }

    private static getRpcNode() {
        let rpc_node_idx = AppSettings.rpcNode.value;
        if (rpc_node_idx >= Config.allowed_tezos_nodes.length) {
            Logging.Warn("Invalid RPC node set - using default.");
            rpc_node_idx = 0;
        }

        return Config.allowed_tezos_nodes[rpc_node_idx];
    }

    private static getNetworkType() {
        if (Conf.tezos_network === "mainnet") return NetworkType.MAINNET;
        else if (Conf.tezos_network === "hangzhou2net") return NetworkType.HANGZHOUNET;

        assert(Conf.tezos_network === "sandboxnet");
        return NetworkType.CUSTOM;
    }

    // A convenience function to check if a wallet (or signer) is set up/connected.
    public isWalletConnected = (): boolean => {
        if (this.walletAddress !== undefined) return true;
        return false;
    }

    public tezosToolkit = (): TezosToolkit => {
        return this.tezos;
    }

    public walletPHK = (): string => {
        if (!this.walletAddress) throw new Error("No wallet connected");
        return this.walletAddress;
    }

    public walletEvents = (): EventEmitter => {
        return this.walletEventEmitter;
    }

    public setupBeaconWallet() {
        const options: DAppClientOptions = {
            name: isDev() ? 'tz1and-dev' : 'tz1and',
            preferredNetwork: TezosWalletProvider.getNetworkType(),
            appUrl: Conf.public_url,
            iconUrl: Conf.public_url + "/logo192.png"
        };
        this.beaconWallet = new BeaconWallet(options);

        /*this.state.beaconWallet.client.subscribeToEvent(BeaconEvent.PERMISSION_REQUEST_SUCCESS, (data) => {
            Logging.LogDev('permission data:', data);
        });*/

        // Set wallet provider.
        this.tezos.setWalletProvider(this.beaconWallet);

        // Check if wallet is already connected.
        this.beaconWallet.client.getActiveAccount().then((activeAccount) => {
            if(activeAccount) {
                this.walletAddress = activeAccount.address;
                this.walletEventEmitter.emit("walletChange");
            }
        });
    }

    public connectWallet = async () => {
        assert(this.beaconWallet);

        const activeAccount = await this.beaconWallet.client.getActiveAccount();

        if (activeAccount) {
            this.walletAddress = activeAccount.address;
        } else {
            await this.beaconWallet.requestPermissions({ network: {
                type: TezosWalletProvider.getNetworkType(),
                name: Conf.tezos_network,
                rpcUrl: TezosWalletProvider.getRpcNode() } });

            const address = await this.beaconWallet.getPKH();
            this.walletAddress = address;
            this.walletEventEmitter.emit("walletChange");
        }
    }

    public disconnectWallet = () => {
        assert(this.beaconWallet);

        // NOte: when using disconnect, on reaload you
        // get a "invalid hex string" error. report it?
        //this.beaconWallet.disconnect();
        this.beaconWallet.clearActiveAccount().then(() => {
            this.walletAddress = undefined;
            this.walletEventEmitter.emit("walletChange");
        });
    }

    private setupWallet() {
        // Who knows if this will strip the in-memory signer from the package...
        if(import.meta.env.DEV && useInMemorySigner) {
            // NOTE: these are KNOWN account keys.
            // alice: edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq
            // bob: edsk3RFfvaFaxbHx8BMtEW1rKQcPtDML3LXjNqMNLCzC3wLC1bWbAt
            import('@taquito/signer').then(signerModule => {
                signerModule.InMemorySigner.fromSecretKey('edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq').then((signer) => {
                    this.tezos.setProvider({signer});
                    signer.publicKeyHash().then((pkh) => {
                        this.walletAddress = pkh;
                        this.walletEventEmitter.emit("walletChange");
                    });
                });
            });
        }
        else this.setupBeaconWallet();
    }

    // Transaction overlay stuff
    public addWalletOperation = (hash: string) => {
        this.walletEventEmitter.emit("addOperation", hash);
    }

    public walletOperationDone = (hash: string, completed: boolean, message?: string) => {
        this.walletEventEmitter.emit("operationDone", hash, completed, message);
    }
}

const TezosWalletContext = createContext<ITezosWalletProvider>(new TezosWalletProvider());

export default TezosWalletContext
export const useTezosWalletContext = () => useContext(TezosWalletContext)