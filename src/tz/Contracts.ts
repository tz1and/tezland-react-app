import { Mesh, Node, Quaternion } from "@babylonjs/core";
import { Contract, OpKind, TransactionWalletOperation } from "@taquito/taquito";
import Conf from "../Config";
import { tezToMutez, toHexString } from "../utils/Utils";
import { setFloat16 } from "@petamoriken/float16";
import { char2Bytes } from '@taquito/utils'
import Metadata from "../world/Metadata";
import { InstanceMetadata } from "../world/Place";
import BigNumber from "bignumber.js";
import { ITezosWalletProvider } from "../components/TezosWalletContext";
import { BatchWalletOperation } from "@taquito/taquito/dist/types/wallet/batch-operation";
import { Logging } from "../utils/Logging";


export class Contracts {
    public marketplaces: Contract | null;
    private places: Contract | null;
    private minter: Contract | null;

    constructor() {
        this.marketplaces = null;
        this.places = null;
        this.minter = null;
    }

    public async subscribeToPlaceChanges(walletProvider: ITezosWalletProvider) {
        if (!this.marketplaces)
            this.marketplaces = await walletProvider.tezosToolkit().contract.at(Conf.world_contract);

        walletProvider.tezosToolkit().setProvider({ config: {
            shouldObservableSubscriptionRetry: true,
            streamerPollingIntervalMilliseconds: 20000
        } });

        try {
            const placesOperation = {
                and: [{ destination: Conf.world_contract }, { kind: 'transaction' }]
            }

            const sub = walletProvider.tezosToolkit().stream.subscribeOperation(placesOperation);
            return sub;
        }
        catch (e) {
            Logging.Error(e);
        }
    }

    public async getPlaceOwner(place_id: number): Promise<string> {
        // todo: use indexer
        const responseP = await fetch(`${Conf.bcd_url}/v1/contract/${Conf.tezos_network}/${Conf.place_contract}/transfers?token_id=${place_id}&size=1`);
        const transferInfo = await responseP.json();

        if (transferInfo.total > 0) return transferInfo.transfers[0].to;

        return "";
    }

    // Note: unused.
    /*private async isPlaceOwner(walletProvider: ITezosWalletProvider, place_id: number): Promise<boolean> {
      // check if wallet is connected before calling walletPHK
      if(!walletProvider.isWalletConnected()) return false;

      if(!this.places)
        this.places = await walletProvider.tezosToolkit().contract.at(Conf.place_contract);

      // use get_balance on-chain view.
      const balanceRes = await this.places.contractViews.get_balance({ owner: walletProvider.walletPHK(), token_id: place_id }).executeView({viewCaller: this.places.address});

      return !balanceRes.isZero();
    }*/

    private async isPlaceOperator(walletProvider: ITezosWalletProvider, place_id: number, owner: string): Promise<boolean> {
        // check if wallet is connected before calling walletPHK
        if (!walletProvider.isWalletConnected()) return false;

        if (!this.marketplaces)
            this.marketplaces = await walletProvider.tezosToolkit().contract.at(Conf.world_contract);

        // use is_operator on-chain view.
        const isOperatorRes = await this.marketplaces.contractViews.is_operator({ operator: walletProvider.walletPHK(), owner: owner, token_id: place_id }).executeView({ viewCaller: this.marketplaces.address });

        return isOperatorRes;
    }

    public async isPlaceOwnerOrOperator(walletProvider: ITezosWalletProvider, place_id: number, owner: string): Promise<boolean> {
        // check if wallet is connected before calling walletPHK
        if (!walletProvider.isWalletConnected()) return false;

        if (walletProvider.walletPHK() === owner) return true;

        return this.isPlaceOperator(walletProvider, place_id, owner);
    }

    public async mintItem(walletProvider: ITezosWalletProvider, item_metadata_url: string, royalties: number, amount: number, callback?: () => void) {
        const minterWallet = await walletProvider.tezosToolkit().wallet.at(Conf.minter_contract);

        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("mintItem: No wallet connected");

        const mint_item_op = await minterWallet.methodsObject.mint_Item({
            address: walletProvider.walletPHK(),
            amount: amount,
            royalties: Math.floor(royalties * 10), // royalties in the minter contract are in permille
            metadata: char2Bytes(item_metadata_url)
        }).send();

        this.handleOperation(walletProvider, mint_item_op, callback);
    }

    public async getItem(walletProvider: ITezosWalletProvider, place_id: number, item_id: number, xtz_per_item: number, callback?: () => void) {
        const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.world_contract);

        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("getItem: No wallet connected");

        const get_item_op = await marketplacesWallet.methodsObject.get_item({
            lot_id: place_id, item_id: item_id
        }).send({ amount: xtz_per_item, mutez: false });

        this.handleOperation(walletProvider, get_item_op, callback);
    }

    public async countPlacesView(walletProvider: ITezosWalletProvider): Promise<BigNumber> {
        if (!this.places)
            this.places = await walletProvider.tezosToolkit().contract.at(Conf.place_contract);

        return await this.places.contractViews.count_tokens().executeView({ viewCaller: this.places.address });
    }

    public async hasPlaceUpdated(walletProvider: ITezosWalletProvider, place_id: number): Promise<boolean> {
        if (!this.marketplaces)
            this.marketplaces = await walletProvider.tezosToolkit().contract.at(Conf.world_contract);

        const stSeqKey = "placeSeq";

        // Read sequence number from storage and contract
        const placeSequenceStore = await Metadata.Storage.loadObject(place_id, stSeqKey);
        const seqRes = await this.marketplaces.contractViews.get_place_seqnum(place_id).executeView({ viewCaller: this.marketplaces.address });

        // If they are not the same, reload from blockchain
        if (placeSequenceStore !== seqRes) {
            Metadata.Storage.saveObject(place_id, stSeqKey, seqRes);
            return true;
        }
        else return false;
    }

    public async getItemsForPlaceView(walletProvider: ITezosWalletProvider, place_id: number, placeUpdated: boolean): Promise<any> {
        // use get_place_data on-chain view.
        if (!this.marketplaces)
            this.marketplaces = await walletProvider.tezosToolkit().contract.at(Conf.world_contract);

        const stItemsKey = "placeItems";

        if (placeUpdated) {
            Logging.InfoDev("place items outdated, reading from chain")

            const result = await this.marketplaces.contractViews.get_place_data(place_id).executeView({ viewCaller: this.marketplaces.address });

            const foreachPairs: { id: number; data: object }[] = [];
            result.stored_items.forEach((val: object, key: number) => {
                foreachPairs.push({ id: key, data: val });
            });

            const place_data = { stored_items: foreachPairs, place_props: result.place_props }

            // TODO: await save?
            Metadata.Storage.saveObject(place_id, stItemsKey, place_data);

            return place_data;
        } else { // Otherwise load items from storage
            Logging.InfoDev("reading place from local storage")

            const placeItemsStore = await Metadata.Storage.loadObject(place_id, stItemsKey);

            return placeItemsStore;
        }

        //return result; // as MichelsonMap<MichelsonTypeNat, any>;
    }

    public async saveItems(walletProvider: ITezosWalletProvider, remove: Node[], add: Node[], place_id: number, owner: string, callback?: () => void) {
        const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.world_contract);
        const itemsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.item_contract);

        const wallet_phk = walletProvider.walletPHK();

        // build remove item list
        const remove_item_list: BigNumber[] = [];
        remove.forEach((item) => {
            const metadata = item.metadata as InstanceMetadata;
            remove_item_list.push(metadata.id);
        });

        // build add item list
        const add_item_list: object[] = [];
        const item_set = new Set<BigNumber>();
        add.forEach((item) => {
            const mesh = item as Mesh;
            const metadata = mesh.metadata as InstanceMetadata;
            const token_id = metadata.itemTokenId;
            const item_amount = metadata.itemAmount;
            const item_price = tezToMutez(metadata.xtzPerItem);
            const rot = mesh.rotationQuaternion ? mesh.rotationQuaternion : new Quaternion();
            // 4 floats for quat, 1 float scale, 3 floats pos = 8 half floats = 16 bytes
            const array = new Uint8Array(16);
            const view = new DataView(array.buffer);
            // quat
            setFloat16(view, 0, rot.x);
            setFloat16(view, 2, rot.y);
            setFloat16(view, 4, rot.z);
            setFloat16(view, 6, rot.w);
            // scale
            setFloat16(view, 8, Math.abs(mesh.scaling.x));
            // pos
            setFloat16(view, 10, mesh.position.x);
            setFloat16(view, 12, mesh.position.y);
            setFloat16(view, 14, mesh.position.z);
            const item_data = toHexString(array);

            add_item_list.push({ item: { token_id: token_id, token_amount: item_amount, xtz_per_token: item_price, item_data: item_data } });

            item_set.add(token_id);
        });

        // build operator add/remove lists
        const operator_adds: object[] = [];
        const operator_removes: object[] = [];

        item_set.forEach((token_id) => {
            operator_adds.push({
                add_operator: {
                    owner: wallet_phk,
                    operator: marketplacesWallet.address,
                    token_id: token_id
                }
            });

            operator_removes.push({
                remove_operator: {
                    owner: wallet_phk,
                    operator: marketplacesWallet.address,
                    token_id: token_id
                }
            });
        });

        // prepare batch
        const batch = walletProvider.tezosToolkit().wallet.batch();

        if (operator_adds.length > 0) batch.with([{
            kind: OpKind.TRANSACTION,
            ...itemsWallet.methods.update_operators(operator_adds).toTransferParams()
        }]);

        // removals first. because of item limit.
        if (remove_item_list.length > 0) batch.with([{
            kind: OpKind.TRANSACTION,
            ...marketplacesWallet.methodsObject.remove_items({
                lot_id: place_id, item_list: remove_item_list, owner: owner
            }).toTransferParams()
        }]);

        if (add_item_list.length > 0) batch.with([{
            kind: OpKind.TRANSACTION,
            ...marketplacesWallet.methodsObject.place_items({
                lot_id: place_id, item_list: add_item_list, owner: owner
            }).toTransferParams()
        }]);

        if (operator_removes.length > 0) batch.with([{
            kind: OpKind.TRANSACTION,
            ...itemsWallet.methods.update_operators(operator_removes).toTransferParams()
        }]);

        const batch_op = await batch.send();

        this.handleOperation(walletProvider, batch_op, callback);
    }

    public handleOperation(walletProvider: ITezosWalletProvider, op: TransactionWalletOperation | BatchWalletOperation, callback?: () => void) {
        walletProvider.addWalletOperation(op.opHash);
        op.confirmation().then(() => {
            walletProvider.walletOperationDone(op.opHash, true);

            if (callback) callback();
        }, (e: any) => {
            walletProvider.walletOperationDone(op.opHash, false, e.message);
        })
    }
}

export default new Contracts();
