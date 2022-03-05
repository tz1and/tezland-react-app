import { OpKind } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { ITezosWalletProvider } from "../components/TezosWalletContext";
import Conf from "../Config";
import { tezToMutez } from "../utils/Utils";
import Contracts from "./Contracts";

export default class DutchAuction {
    // Duration is in hours.
    static async createAuction(walletProvider: ITezosWalletProvider, placeId: BigNumber, startPrice: number, endPrice: number, duration: number, callback?: (completed: boolean) => void) {
        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auchtion_contract);
        const placesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.place_contract);

        // in the future price_granularity might change. For now it is one minute.
        //const price_granularity = 60; // in seconds.
        const start_time_offset = 45; // in seconds, should be larger than current block time (30s).
        const current_time = Math.floor(Date.now() / 1000);
        const start_time = (Math.floor((current_time + start_time_offset) / 60) + 1) * 60; // begins at the next full minute.
        const end_time = Math.floor(start_time + duration * 3600); // hours to seconds

        const batch = walletProvider.tezosToolkit().wallet.batch([
            {
                kind: OpKind.TRANSACTION,
                ...placesWallet.methodsObject.update_adhoc_operators({ add_adhoc_operators: [{
                        operator: auctionsWallet.address,
                        token_id: placeId
                    }]
                }).toTransferParams()
            },
            {
                kind: OpKind.TRANSACTION,
                ...auctionsWallet.methodsObject.create({
                    token_id: placeId, start_price: tezToMutez(startPrice), end_price: tezToMutez(endPrice),
                    start_time: start_time.toString(), end_time: end_time.toString(), fa2: Conf.place_contract
                }).toTransferParams()
            }
            // Not really needed unless you want to be extra careful.
            /*{
                kind: OpKind.TRANSACTION,
                ...placesWallet.methodsObject.update_adhoc_operators({ clear_adhoc_operators: null }).toTransferParams()
            }*/
        ]);

        try {
            const batch_op = await batch.send();

            Contracts.handleOperation(walletProvider, batch_op, callback);
        }
        catch {
            if(callback) callback(false);
        }
    }

    static async bidOnAuction(walletProvider: ITezosWalletProvider, auction_id: number, price_mutez: number, callback?: (completed: boolean) => void) {
        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auchtion_contract);
  
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("bidOnAuction: No wallet connected");

        try {
            const bid_op = await auctionsWallet.methodsObject.bid({ auction_id: auction_id }).send({ amount: price_mutez, mutez: true });

            Contracts.handleOperation(walletProvider, bid_op, callback);
        }
        catch {
            if(callback) callback(false);
        }
    }

    static async canBidOnAuctions(walletProvider: ITezosWalletProvider): Promise<boolean> {
        if(await DutchAuction.isWhitelistEnabled(walletProvider)) {
            return DutchAuction.isWhitelisted(walletProvider);
        }
        else return true;
    }

    // TODO: don't hardcode admin! use get_administrator view.
    static isAdministrator(walletProvider: ITezosWalletProvider) {
        if (!walletProvider.isWalletConnected()) return false;

        if(walletProvider.walletPHK() === "tz1U3shEPeLdLxyjFWWGjJjNhFugcVV8eCTW")
            return true;
        else return false;
    }

    private static async isWhitelisted(walletProvider: ITezosWalletProvider) {
        // note: this is also checked in Auction, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) return false;

        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auchtion_contract);

        return auctionsWallet.contractViews.is_whitelisted(walletProvider.walletPHK()).executeView({ viewCaller: auctionsWallet.address });

    }

    private static async isWhitelistEnabled(walletProvider: ITezosWalletProvider) {
        // note: this is also checked in Auction, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) return false;

        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auchtion_contract);

        return auctionsWallet.contractViews.is_whitelist_enabled(walletProvider.walletPHK()).executeView({ viewCaller: auctionsWallet.address });

    }

    static async cancelAuction(walletProvider: ITezosWalletProvider, auction_id: number, callback?: (completed: boolean) => void) {
        // note: this is also checked in Auction, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("bidOnAuction: No wallet connected");

        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auchtion_contract);
  
        try {
            const cancel_op = await auctionsWallet.methodsObject.cancel({ auction_id: auction_id }).send();

            Contracts.handleOperation(walletProvider, cancel_op, callback);
        }
        catch {
            if(callback) callback(false);
        }
    }
}
