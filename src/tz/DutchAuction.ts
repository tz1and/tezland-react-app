import { OpKind } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { ITezosWalletProvider } from "../components/TezosWalletContext";
import Conf from "../Config";
import { Logging } from "../utils/Logging";
import { tezToMutez } from "../utils/Utils";
import Contracts from "./Contracts";

export default class DutchAuction {
    // Duration is in hours.
    static async createAuction(walletProvider: ITezosWalletProvider, placeId: BigNumber, startPrice: number, endPrice: number, duration: number, callback?: (completed: boolean) => void) {
        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auction_contract);
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
        ]);

        try {
            const batch_op = await batch.send();

            Contracts.handleOperation(walletProvider, batch_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    static async bidOnAuction(walletProvider: ITezosWalletProvider, auction_id: number, price_mutez: number, callback?: (completed: boolean) => void) {
        if (!walletProvider.isWalletConnected()) await walletProvider.connectWallet();

        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auction_contract);

        try {
            const bid_op = await auctionsWallet.methodsObject.bid({ auction_id: auction_id }).send({ amount: price_mutez, mutez: true });

            Contracts.handleOperation(walletProvider, bid_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    static async isSecondaryMarketEnabled(walletProvider: ITezosWalletProvider): Promise<boolean> {
        const auctions = await walletProvider.tezosToolkit().contract.at(Conf.dutch_auction_contract);

        return auctions.contractViews.is_secondary_enabled().executeView({ viewCaller: auctions.address });
    }

    // TODO: don't hardcode admin! use get_administrator view.
    static isAdministrator(walletProvider: ITezosWalletProvider, admin: string) {
        if (!walletProvider.isWalletConnected()) return false;

        if(walletProvider.walletPHK() === admin)
            return true;
        else return false;
    }

    public static async isWhitelisted(walletProvider: ITezosWalletProvider) {
        // note: this is also checked in Auction, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) return false;

        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auction_contract);

        return auctionsWallet.contractViews.is_whitelisted(walletProvider.walletPHK()).executeView({ viewCaller: auctionsWallet.address });

    }

    public static async isWhitelistEnabled(walletProvider: ITezosWalletProvider) {
        const auctions = await walletProvider.tezosToolkit().contract.at(Conf.dutch_auction_contract);

        return auctions.contractViews.is_whitelist_enabled().executeView({ viewCaller: auctions.address });
    }

    public static async getAdministrator(walletProvider: ITezosWalletProvider) {
        const auctions = await walletProvider.tezosToolkit().contract.at(Conf.dutch_auction_contract);

        return auctions.contractViews.get_administrator().executeView({ viewCaller: auctions.address });
    }

    static async cancelAuction(walletProvider: ITezosWalletProvider, auction_id: number, callback?: (completed: boolean) => void) {
        // note: this is also checked in Auction, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("bidOnAuction: No wallet connected");

        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auction_contract);
  
        try {
            const cancel_op = await auctionsWallet.methodsObject.cancel({ auction_id: auction_id }).send();

            Contracts.handleOperation(walletProvider, cancel_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }
}
