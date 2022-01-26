import React, { createContext, useContext } from "react"
import { TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from '@taquito/beacon-wallet';
import { NetworkType, DAppClientOptions } from '@airgap/beacon-sdk';
import Conf from "../Config";
import { isDev } from "../utils/Utils";
import { InMemorySigner } from "@taquito/signer";
import EventEmitter from "events";
import { OperationPending, OperationPendingData } from "./OperationPending";

export type ITezosWalletProvider = {
    //setWalletAddress(walletAddress: string): void
    connectWallet: () => void,
    disconnectWallet: () => void,
    isWalletConnected: () => boolean,
    tezosToolkit: () => TezosToolkit,
    walletPHK: () => string,
    walletEvents: () => EventEmitter

    addWalletOperation(hash: string): void;
    walletOperationDone(hash: string, success: boolean, message?: string): void;
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
    walletAddress?: string,
    useInMemorySigner: boolean,
    pendingOps: OperationPendingData[];
}

class TezosWalletProvider extends React.Component<TezosWalletProviderProps, TezosWalletProviderState> {
    private walletEventEmitter: EventEmitter;

    constructor(props: TezosWalletProviderProps) {
        super(props);
        this.walletEventEmitter = new EventEmitter();
        this.state = {
            tezos: new TezosToolkit(Conf.tezos_node),
            useInMemorySigner: false,
            pendingOps: []
        };
    }

    componentDidMount() {
        //this.enableInMemorySigner(); // DEV
        this.initWallet();
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
        return this.walletEventEmitter;
    }

    public initWallet() {
        const options: DAppClientOptions = {
            name: isDev() ? 'TezlandApp-dev' : 'TezlandApp',
            //preferredNetwork: NetworkType.MAINNET, // For mainnet
            preferredNetwork: NetworkType.CUSTOM, // for dev
            appUrl: "http://localhost:3006",
            iconUrl: "http://localhost:3006/logo192.png",
            /*eventHandlers: {
              PERMISSION_REQUEST_SUCCESS: {
                handler: async (data: any) => {
                  console.log('permission data:', data);
                },
              },
            }*/
        };
        this.setState({ beaconWallet: new BeaconWallet(options) }, () => {
            this.state.tezos.setWalletProvider(this.state.beaconWallet);

            this.state.beaconWallet!.getPKH().then((address) => {
                this.setState({ walletAddress: address }, () => this.walletEventEmitter.emit("walletChange"));
            }, () => { });
        });
    }

    public connectWallet = () => {
        if (!this.state.beaconWallet) return;

        this.state.beaconWallet.getPKH().then((address) => {
            this.setState({ walletAddress: address });
        }, () => {
            this.state.beaconWallet!
                //.requestPermissions({ network: { type: NetworkType.MAINNET } }) // For mainnet
                .requestPermissions({ network: { type: NetworkType.CUSTOM, name: "sandbox", rpcUrl: Conf.tezos_node } }) // for dev
                .then((_) => this.state.beaconWallet!.getPKH())
                .then((address) => this.setState({ walletAddress: address }, () => this.walletEventEmitter.emit("walletChange")));
        })
    }

    public disconnectWallet = () => {
        if (!this.state.beaconWallet) return;

        // NOte: when using disconnect, on reaload you
        // get a "invalid hex string" error. report it?
        //this.beaconWallet.disconnect();
        this.state.beaconWallet.clearActiveAccount();
        this.setState({ walletAddress: undefined }, () => this.walletEventEmitter.emit("walletChange"))
    }

    private enableInMemorySigner() {
        // NOTE: these are KNOWN account keys.
        // alice: edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq
        // bob: edsk3RFfvaFaxbHx8BMtEW1rKQcPtDML3LXjNqMNLCzC3wLC1bWbAt
        InMemorySigner.fromSecretKey('edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq').then((signer) => {
          this.state.tezos.setProvider({signer});
          signer.publicKeyHash().then((pkh) => this.setState({ walletAddress: pkh, useInMemorySigner: true }));
        })
    }

    // Transaction overlay stuff
    public addWalletOperation = (hash: string) => {
        this.setState({ pendingOps: this.state.pendingOps.concat({hash: hash, done: false }) });
    }

    public walletOperationDone = (hash: string, success: boolean, message?: string) => {
        const elem = this.state.pendingOps.find((v) => v.hash === hash);
        if(elem) {
            elem.done = true;
            elem.success = success;
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

    render() {
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