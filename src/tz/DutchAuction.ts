import { OpKind } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { ITezosWalletProvider } from "../components/TezosWalletContext";
import Conf from "../Config";
import { tezToMutez } from "../utils/Utils";
import Contracts from "./Contracts";

export default class DutchAuction {
    // Duration is in hours.
    static async createAuction(walletProvider: ITezosWalletProvider, placeId: BigNumber, startPrice: number, endPrice: number, duration: number, callback?: () => void) {
        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auchtion_contract);
        const placesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.place_contract);

        /*def create(self, params):

        sp.set_type(params.token_id, sp.TNat)
        sp.set_type(params.start_price, sp.TMutez)
        sp.set_type(params.end_price, sp.TMutez)
        sp.set_type(params.start_time, sp.TTimestamp)
        sp.set_type(params.end_time, sp.TTimestamp)*/

        const current_time = Math.floor(Date.now() / 1000);
        const start_time = (Math.floor(current_time / 60) + 1) * 60; // begins at the next full minute.
        const end_time = Math.floor(start_time + duration * 3600); // hours to seconds

        const batch = walletProvider.tezosToolkit().wallet.batch([
            {
                kind: OpKind.TRANSACTION,
                ...placesWallet.methods.update_operators([{
                    add_operator: {
                        owner: walletProvider.walletPHK(),
                        operator: auctionsWallet.address,
                        token_id: placeId
                    }
                }]).toTransferParams()
            },
            {
                kind: OpKind.TRANSACTION,
                ...auctionsWallet.methodsObject.create({
                    token_id: placeId, start_price: tezToMutez(startPrice), end_price: tezToMutez(endPrice),
                    start_time: start_time.toString(), end_time: end_time.toString(), fa2: Conf.place_contract
                }).toTransferParams()
            }
        ]);

        /*const operator_op = await  .send();
          await operator_op.confirmation();*/

        /*const create_auction_op = await auctionsWallet.methodsObject.create({
            token_id: placeId, start_price: tezToMutez(startPrice), end_price: tezToMutez(endPrice),
            start_time: start_time.toString(), end_time: end_time.toString()
        }).send();
        await create_auction_op.confirmation();*/

        const batch_op = await batch.send();

        Contracts.handleOperation(walletProvider, batch_op, callback);
    }

    static async bidOnAuction(walletProvider: ITezosWalletProvider, auction_id: number, price_mutez: number, callback?: () => void) {
        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auchtion_contract);
  
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if(!walletProvider.isWalletConnected()) throw new Error("bidOnAuction: No wallet connected");
  
        const bid_op = await auctionsWallet.methodsObject.bid(auction_id).send({ amount: price_mutez, mutez: true });

        Contracts.handleOperation(walletProvider, bid_op, callback);
    }

    static async cancelAuction(walletProvider: ITezosWalletProvider, auction_id: number, callback?: () => void) {
        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auchtion_contract);
  
        // note: this is also checked in Auction, probably don't have to recheck, but better safe.
        if(!walletProvider.isWalletConnected()) throw new Error("bidOnAuction: No wallet connected");
  
        const cancel_op = await auctionsWallet.methodsObject.cancel(auction_id).send();

        Contracts.handleOperation(walletProvider, cancel_op, callback);
    }
}
