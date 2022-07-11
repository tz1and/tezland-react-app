import React, { createContext, PropsWithChildren, useContext } from "react"
import { TezosToolkit } from "@taquito/taquito";
import { RpcClient, RpcClientCache } from '@taquito/rpc';
import { BeaconWallet } from '@taquito/beacon-wallet';
import { NetworkType, DAppClientOptions } from '@airgap/beacon-dapp';
import Conf from "../Config";
import { isDev } from "../utils/Utils";
import { InMemorySigner } from "@taquito/signer";
import EventEmitter from "events";
import { OperationPending, OperationPendingData } from "./OperationPending";
import assert from "assert";
import AppSettings from "../storage/AppSettings";
import Config from "../Config";

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

// Ignore the following because I can't be bothered to fill
// in the default that isn't used anyway.
// @ts-expect-error
const TezosWalletContext = createContext<ITezosWalletProvider>({
    /*connectWallet: () => { },
    disconnectWallet: () => { },
    isWalletConnected: (): boolean => { return false }*/
});

type TezosWalletProviderProps = {}

type TezosWalletProviderState = {
    tezos: TezosToolkit,
    beaconWallet?: BeaconWallet,
    walletAddress?: string | undefined,
    pendingOps: OperationPendingData[],
    walletEventEmitter: EventEmitter
}

// For development only.
const useInMemorySigner = false;

class TezosWalletProvider extends React.Component<PropsWithChildren<TezosWalletProviderProps>, TezosWalletProviderState> {

    constructor(props: TezosWalletProviderProps) {
        super(props);
        this.state = {
            tezos: new TezosToolkit(new RpcClientCache(new RpcClient(Config.allowed_tezos_nodes[AppSettings.rpcNode.value]))),
            pendingOps: [],
            walletEventEmitter: new EventEmitter()
        };
    }

    override componentDidMount() {
        this.setupWallet();
    }

    override componentWillUnmount() {
        this.state.walletEventEmitter.removeAllListeners();
    }

    // A convenience function to check if a wallet (or signer) is set up/connected.
    public isWalletConnected = (): boolean => {
        if (this.state.walletAddress !== undefined) return true;
        return false;
    }

    public tezosToolkit = (): TezosToolkit => {
        return this.state.tezos;
    }

    public walletPHK = (): string => {
        if (!this.state.walletAddress) throw new Error("No wallet connected");
        return this.state.walletAddress;
    }

    public walletEvents = (): EventEmitter => {
        return this.state.walletEventEmitter;
    }

    private static getNetworkType() {
        if (Conf.tezos_network === "mainnet") return NetworkType.MAINNET;
        else if (Conf.tezos_network === "hangzhou2net") return NetworkType.HANGZHOUNET;

        assert(Conf.tezos_network === "sandboxnet");
        return NetworkType.CUSTOM;
    }

    public setupBeaconWallet() {
        const appUrl = isDev() ? "http://localhost:3006" : Conf.public_url;
        const options: DAppClientOptions = {
            name: isDev() ? 'tz1and-dev' : 'tz1and',
            preferredNetwork: TezosWalletProvider.getNetworkType(),
            appUrl: appUrl,
            iconUrl: appUrl + "/logo192.png",
            /*eventHandlers: {
              PERMISSION_REQUEST_SUCCESS: {
                handler: async (data: any) => {
                  Logging.LogDev('permission data:', data);
                },
              },
            }*/
        };
        this.setState({ beaconWallet: new BeaconWallet(options) }, () => {
            assert(this.state.beaconWallet);

            // Set wallet provider.
            this.state.tezos.setWalletProvider(this.state.beaconWallet);

            // Check if wallet is already connected.
            this.state.beaconWallet!.client.getActiveAccount().then((activeAccount) => {
                if(activeAccount) {
                    this.setState({ walletAddress: activeAccount.address }, () => this.state.walletEventEmitter.emit("walletChange"));
                }
            });
        });
    }

    public connectWallet = async () => {
        assert(this.state.beaconWallet);

        const activeAccount = await this.state.beaconWallet.client.getActiveAccount();

        if (activeAccount) {
            this.setState({ walletAddress: activeAccount.address });
        } else {
            await this.state.beaconWallet.requestPermissions({ network: {
                type: TezosWalletProvider.getNetworkType(),
                name: Conf.tezos_network,
                rpcUrl: Config.allowed_tezos_nodes[AppSettings.rpcNode.value] } });

            const address = await this.state.beaconWallet.getPKH();
            this.setState({ walletAddress: address }, () => this.state.walletEventEmitter.emit("walletChange"));
        }
    }

    public disconnectWallet = () => {
        assert(this.state.beaconWallet);

        // NOte: when using disconnect, on reaload you
        // get a "invalid hex string" error. report it?
        //this.beaconWallet.disconnect();
        this.state.beaconWallet.clearActiveAccount();
        this.setState({ walletAddress: undefined }, () => this.state.walletEventEmitter.emit("walletChange"))
    }

    private setupWallet() {
        if(isDev() && useInMemorySigner) {
            // NOTE: these are KNOWN account keys.
            // alice: edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq
            // bob: edsk3RFfvaFaxbHx8BMtEW1rKQcPtDML3LXjNqMNLCzC3wLC1bWbAt
            InMemorySigner.fromSecretKey('edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq').then((signer) => {
                this.state.tezos.setProvider({signer});
                signer.publicKeyHash().then((pkh) => this.setState({ walletAddress: pkh }, () => this.state.walletEventEmitter.emit("walletChange")));
            })
        }
        else this.setupBeaconWallet();
    }

    // Transaction overlay stuff
    public addWalletOperation = (hash: string) => {
        this.setState({ pendingOps: this.state.pendingOps.concat({hash: hash, done: false }) });
    }

    public walletOperationDone = (hash: string, completed: boolean, message?: string) => {
        const elem = this.state.pendingOps.find((v) => v.hash === hash);
        if(elem) {
            elem.done = true;
            elem.success = completed;
            elem.error = message;

            this.setState({pendingOps: this.state.pendingOps});

            // warnign: dangling timeout.
            setTimeout(() => {
                this.removePendingOpetation(hash);
            }, 30000);
        }
    }

    private removePendingOpetation(hash: string) {
        const newPending: OperationPendingData[] = [];
        for(const p of this.state.pendingOps) {
            if(p.hash !== hash) newPending.push(p);
        }
        this.setState({pendingOps: newPending});
    }

    override render() {
        const { children } = this.props

        let toasts = this.state.pendingOps.map(v => { return <OperationPending data={v} key={v.hash} /> });

        return (
            <TezosWalletContext.Provider
                value={{
                    connectWallet: this.connectWallet,
                    disconnectWallet: this.disconnectWallet,
                    isWalletConnected: this.isWalletConnected,
                    tezosToolkit: this.tezosToolkit,
                    walletPHK: this.walletPHK,
                    walletEvents: this.walletEvents,
                    addWalletOperation: this.addWalletOperation,
                    walletOperationDone: this.walletOperationDone
                }}
            >
                {children}
                <div className="toast-container position-fixed bottom-0 end-0 p-5 px-4" style={{zIndex: "1050"}}>{toasts}</div>
            </TezosWalletContext.Provider>
        )
    }
}

export default TezosWalletContext

export const useTezosWalletContext = () => useContext(TezosWalletContext)

export { TezosWalletProvider }