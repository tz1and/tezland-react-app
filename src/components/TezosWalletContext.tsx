import React, { createContext, useContext } from "react"
import { TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from '@taquito/beacon-wallet';
import { NetworkType, DAppClientOptions } from '@airgap/beacon-sdk';
import Conf from "../Config";
import { isDev } from "../utils/Utils";
import { InMemorySigner } from "@taquito/signer";
import EventEmitter from "events";

export type ITezosWalletProvider = {
    //setWalletAddress(walletAddress: string): void
    connectWallet: () => void,
    disconnectWallet: () => void,
    isWalletConnected: () => boolean,
    tezosToolkit: () => TezosToolkit,
    walletPHK: () => string,
    walletEvents: () => EventEmitter
}

// @ts-ignore
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
    useInMemorySigner: boolean
}

// TODO: fetch owned places from landex and make a dropdown of places.

class TezosWalletProvider extends React.Component<TezosWalletProviderProps, TezosWalletProviderState> {
    private walletEventEmitter: EventEmitter;

    constructor(props: TezosWalletProviderProps) {
        super(props);
        this.walletEventEmitter = new EventEmitter();
        this.state = {
            tezos: new TezosToolkit(Conf.tezos_node),
            useInMemorySigner: false
        };
    }

    componentDidMount() {
        //this.enableInMemorySigner(); // or
        this.initWallet(); // either
    }

    // A convenience function to check if a wallet (or signer) is set up/connected.
    isWalletConnected(): boolean {
        if (this.state.walletAddress !== undefined) return true;
        return false;
    }

    tezosToolkit(): TezosToolkit {
        return this.state.tezos;
    }

    walletPHK(): string {
        if (!this.state.walletAddress) throw new Error("No wallet connected");
        return this.state.walletAddress;
    }

    walletEvents(): EventEmitter {
        return this.walletEventEmitter;
    }

    public initWallet() {
        //console.log("called initWallet");

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

    public connectWallet() {
        //console.log("called connectWallet");
        if (!this.state.beaconWallet) return;

        this.state.beaconWallet.getPKH().then((address) => {
            this.setState({ walletAddress: address });
        }, () => {
            // TODO: have some global event handler all kinds of stuff can subscribe to
            // on wallet connected.
            this.state.beaconWallet!
                //.requestPermissions({ network: { type: NetworkType.MAINNET } }) // For mainnet
                .requestPermissions({ network: { type: NetworkType.CUSTOM, name: "sandbox", rpcUrl: Conf.tezos_node } }) // for dev
                .then((_) => this.state.beaconWallet!.getPKH())
                .then((address) => this.setState({ walletAddress: address }, () => this.walletEventEmitter.emit("walletChange")));
        })
    }

    public disconnectWallet() {
        //console.log("called disconnectWallet");
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

    render() {
        const { children } = this.props

        let connectWalletCB = this.connectWallet.bind(this);
        let disconnectWalletCB = this.disconnectWallet.bind(this);
        let isWalletConnectedCB = this.isWalletConnected.bind(this);
        let tezosToolkitCB = this.tezosToolkit.bind(this);
        let walletPHKCB = this.walletPHK.bind(this);
        let walletEventsCB = this.walletEvents.bind(this);

        return (
            <TezosWalletContext.Provider
                value={{
                    connectWallet: connectWalletCB,
                    disconnectWallet: disconnectWalletCB,
                    isWalletConnected: isWalletConnectedCB,
                    tezosToolkit: tezosToolkitCB,
                    walletPHK: walletPHKCB,
                    walletEvents: walletEventsCB
                }}
            >
                {children}
            </TezosWalletContext.Provider>
        )
    }
}

export default TezosWalletContext

export const useTezosWalletContext = () => useContext(TezosWalletContext)

export { TezosWalletProvider }