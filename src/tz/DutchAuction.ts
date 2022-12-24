import { MichelCodecPacker, OpKind } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { ITezosWalletProvider } from "../components/TezosWalletContext";
import { MichelsonV1Expression } from '@taquito/rpc';
import { Schema } from '@taquito/michelson-encoder';
import Conf from "../Config";
import { Logging } from "../utils/Logging";
import { tezToMutez } from "../utils/Utils";
import Contracts from "./Contracts";
import { SHA3 } from 'sha3';


export class AuctionKey {
    readonly token_id: BigNumber;
    readonly fa2: string;
    readonly owner: string;

    constructor(token_id: BigNumber, fa2: string, owner: string) {
        this.token_id = token_id;
        this.fa2 = fa2;
        this.owner = owner;
    }

    public static fromNumber(token_id: number, fa2: string, owner: string): AuctionKey {
        return new AuctionKey(new BigNumber(token_id), fa2, owner);
    }

    public toString(): string {
        return `${this.fa2}#${this.token_id.toNumber()}#${this.owner}`;
    }
}

export default class DutchAuction {
    // Duration is in hours.
    static async createAuction(walletProvider: ITezosWalletProvider, fa2: string, tokenId: BigNumber, startPrice: number, endPrice: number, duration: number, callback?: (completed: boolean) => void) {
        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auction_contract);
        const placesWallet = await walletProvider.tezosToolkit().wallet.at(fa2);

        // in the future price_granularity might change. For now it is one minute.
        //const price_granularity = 60; // in seconds.
        const start_time_offset = 45; // in seconds, should be larger than current block time (30s).
        const current_time = Math.floor(Date.now() / 1000);
        const start_time = (Math.floor((current_time + start_time_offset) / 60) + 1) * 60; // begins at the next full minute.
        const end_time = Math.floor(start_time + duration * 3600); // hours to seconds

        const batch = walletProvider.tezosToolkit().wallet.batch([
            {
                kind: OpKind.TRANSACTION,
                ...placesWallet.methodsObject.update_operators([{ add_operator: {
                        owner: walletProvider.walletPHK(),
                        operator: auctionsWallet.address,
                        token_id: tokenId
                    }
                }]).toTransferParams()
            },
            {
                kind: OpKind.TRANSACTION,
                ...auctionsWallet.methodsObject.create({
                    auction_key: {
                        fa2: fa2,
                        token_id: tokenId,
                        owner: walletProvider.walletPHK()
                    },
                    auction: {
                        start_price: tezToMutez(startPrice),
                        end_price: tezToMutez(endPrice),
                        start_time: start_time.toString(),
                        end_time: end_time.toString()
                    }
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

    private static async getHashedPlaceSeq(walletProvider: ITezosWalletProvider, fa2: string, token_id: number) {
        // Place seq type type:
        // (pair (bytes %place_seq) (map %chunk_seqs nat bytes))

        // Type as michelson expression
        const placeSeqStorageType: MichelsonV1Expression = {
            prim: 'pair',
            args: [
                { prim: 'bytes', annots: [ '%place_seq' ] },
                { prim: 'map', args: [ { prim: 'nat' }, { prim: 'bytes' } ], annots: [ '%chunk_seqs' ] }
            ]
        };

        const world_contract = await Contracts.get_world_contract_read(walletProvider);

        // Get place seq.
        const place_seq = await world_contract.contractViews.get_place_seqnum({
            place_key: {fa2: fa2, id: token_id}
        }).executeView({viewCaller: world_contract.address});

        // Encode result as a michelson expression.
        const storageSchema = new Schema(placeSeqStorageType);
        const placeSeqDataMichelson = storageSchema.Encode(place_seq);

        // Pack encoded michelson data.
        const packer = new MichelCodecPacker();
        const packedPlaceSeq = await packer.packData({ data: placeSeqDataMichelson, type: placeSeqStorageType });

        // Return hash.
        return new SHA3(256).update(packedPlaceSeq.packed, 'hex').digest('hex');
    }

    static async bidOnAuction(walletProvider: ITezosWalletProvider, fa2: string, token_id: number, owner: string, price_mutez: number, callback?: (completed: boolean) => void) {
        if (!walletProvider.isWalletConnected()) await walletProvider.connectWallet();

        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auction_contract);

        const seq_hash = await this.getHashedPlaceSeq(walletProvider, fa2, token_id);

        try {
            const bid_op = await auctionsWallet.methodsObject.bid({
                auction_key: {
                    fa2: fa2,
                    token_id: token_id,
                    owner: owner
                },
                seq_hash: seq_hash
            }).send({ amount: price_mutez, mutez: true });

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

    public static async auctionExists(walletProvider: ITezosWalletProvider, fa2: string, token_id: number) {
        const auctions = await walletProvider.tezosToolkit().contract.at(Conf.dutch_auction_contract);

        try {
            await auctions.contractViews.get_auction({fa2: fa2, token_id: token_id, owner: walletProvider.walletPHK()}).executeView({ viewCaller: auctions.address });
            return true;
        }
        catch(e) {
            return false;
        }
    }

    public static async isWhitelisted(walletProvider: ITezosWalletProvider, fa2: string) {
        // note: this is also checked in Auction, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) return false;

        const auctions = await walletProvider.tezosToolkit().contract.at(Conf.dutch_auction_contract);

        return auctions.contractViews.is_whitelisted({fa2: fa2, user: walletProvider.walletPHK()}).executeView({ viewCaller: auctions.address });

    }

    public static async getWhitelistSettingsForToken(walletProvider: ITezosWalletProvider, fa2: string): Promise<[boolean, string]> {
        const auctions = await walletProvider.tezosToolkit().contract.at(Conf.dutch_auction_contract);

        const res = await auctions.contractViews.get_fa2_permitted(fa2).executeView({ viewCaller: auctions.address });

        return [res.whitelist_enabled, res.whitelist_admin];
    }

    /*public static async canCreateAuctionForToken(walletProvider: ITezosWalletProvider, fa2: string) {
        const auctions = await walletProvider.tezosToolkit().contract.at(Conf.dutch_auction_contract);

        const res = await auctions.contractViews.get_fa2_permitted(fa2).executeView({ viewCaller: auctions.address });
        if (res.whitelist_enabled && res.whitelist_admin === walletProvider.walletPHK()) return true;

        return !res.whitelist_enabled;
    }*/

    /*public static async getAdministrator(walletProvider: ITezosWalletProvider) {
        const auctions = await walletProvider.tezosToolkit().contract.at(Conf.dutch_auction_contract);

        return auctions.contractViews.get_administrator().executeView({ viewCaller: auctions.address });
    }*/

    static async cancelAuction(walletProvider: ITezosWalletProvider, fa2: string, token_id: number, owner: string, callback?: (completed: boolean) => void) {
        // note: this is also checked in Auction, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("bidOnAuction: No wallet connected");

        const auctionsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.dutch_auction_contract);
        const placesWallet = await walletProvider.tezosToolkit().wallet.at(fa2);

        const batch = walletProvider.tezosToolkit().wallet.batch([
            {
                kind: OpKind.TRANSACTION,
                ...placesWallet.methodsObject.update_operators([{ remove_operator: {
                        owner: walletProvider.walletPHK(),
                        operator: auctionsWallet.address,
                        token_id: token_id
                    }
                }]).toTransferParams()
            },
            {
                kind: OpKind.TRANSACTION,
                ...auctionsWallet.methodsObject.cancel({
                    auction_key: {
                        fa2: fa2,
                        token_id: token_id,
                        owner: owner
                    }
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

    static getPlaceType(fa2: string) {
        if (fa2 === Conf.interior_contract) return "Interior";
        if (fa2 === Conf.place_contract) return "Place";
        Logging.ErrorDev(`Unknown place type: ${fa2}`);
        return "Unknown";
    }
}
