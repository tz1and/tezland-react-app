import { TezosToolkit, ContractAbstraction, ContractProvider } from "@taquito/taquito";
//import { InMemorySigner } from "@taquito/signer";

export class Tezos {
    //private signer: InMemorySigner;
    private tezos: TezosToolkit | null = null;
    async init() {
        //const signer = await InMemorySigner.fromSecretKey("edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq");
        this.tezos = new TezosToolkit("http://192.168.0.93:20000");
        //Tezos.setProvider({ signer: signer });

        //const contrcat = await this.tezos.contract.at("KT1TAfACYWoVo9mgysP5YpQgmkomMTLnPMxy");
    }
}