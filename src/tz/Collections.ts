/**
 * Interface with user collections
 */
import { ITezosWalletProvider } from "../components/TezosWalletContext";
import Conf from "../Config";
import { Logging } from "../utils/Logging";
import Contracts from "./Contracts";
import { char2Bytes } from '@taquito/utils'


export default class Collections {
    static async mintCollection(walletProvider: ITezosWalletProvider, token_metadata_url: string, callback?: (completed: boolean) => void) {
        const factoryWallet = await walletProvider.tezosToolkit().wallet.at(Conf.factory_contract);

        try {
            const create_token_op = await factoryWallet.methods.create_token(char2Bytes(token_metadata_url)).send();

            Contracts.handleOperation(walletProvider, create_token_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }
}