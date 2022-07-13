import { Engine, Scene } from "@babylonjs/core";
import { ITezosWalletProvider } from "../components/TezosWalletContext";

export interface WorldInterface {
    readonly walletProvider: ITezosWalletProvider;

    readonly engine: Engine;
    readonly scene: Scene;
}