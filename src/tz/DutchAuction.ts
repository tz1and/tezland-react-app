import { Contract, OpKind } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import Conf from "../Config";
import Contracts from "./Contracts";
import { tezToMutez } from "./Utils";

class DutchAuction {
    private auction: Contract | null;

    constructor() {
        this.auction = null;
    }

    // Duration is in hours.
    public async createAuction(placeId: BigNumber, startPrice: number, endPrice: number, duration: number) {
        const auctionsWallet = await Contracts.wallet().at(Conf.dutch_auchtion_contract);
        const placesWallet = await Contracts.wallet().at(Conf.place_contract);

        /*def create(self, params):

        sp.set_type(params.token_id, sp.TNat)
        sp.set_type(params.start_price, sp.TMutez)
        sp.set_type(params.end_price, sp.TMutez)
        sp.set_type(params.start_time, sp.TTimestamp)
        sp.set_type(params.end_time, sp.TTimestamp)*/

        const current_time = Math.floor(Date.now() / 1000);
        const start_time = (Math.floor(current_time / 60) + 1) * 60; // begins at the next full minute.
        const end_time = start_time + duration * 3600; // hours to seconds

        const batch = Contracts.wallet().batch([
            {
                kind: OpKind.TRANSACTION,
                ...placesWallet.methods.update_operators([{
                    add_operator: {
                        owner: await Contracts.walletPHK(),
                        operator: auctionsWallet.address,
                        token_id: placeId
                    }
                }]).toTransferParams()
            },
            {
                kind: OpKind.TRANSACTION,
                ...auctionsWallet.methodsObject.create({
                    token_id: placeId, start_price: tezToMutez(startPrice), end_price: tezToMutez(endPrice),
                    start_time: start_time.toString(), end_time: end_time.toString()
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
        await batch_op.confirmation();

        //throw new Error("Not implemented");
    }
}

export default new DutchAuction();