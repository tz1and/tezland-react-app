import { Mesh, Node, Quaternion } from "@babylonjs/core";
import { Contract, MichelsonMap, OpKind, TransactionWalletOperation } from "@taquito/taquito";
import Conf from "../Config";
import { tezToMutez, toHexString } from "../utils/Utils";
import { setFloat16 } from "@petamoriken/float16";
import { char2Bytes } from '@taquito/utils'
import Metadata from "../world/Metadata";
import { InstanceMetadata, PlacePermissions } from "../world/Place";
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

        return;
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

    private async queryPlacePermissions(walletProvider: ITezosWalletProvider, place_id: number, owner: string): Promise<PlacePermissions> {
        // check if wallet is connected before calling walletPHK
        if (!walletProvider.isWalletConnected()) return new PlacePermissions(PlacePermissions.permissionNone);

        if (!this.marketplaces)
            this.marketplaces = await walletProvider.tezosToolkit().contract.at(Conf.world_contract);

        // use is_operator on-chain view.
        const permissionsRes: BigNumber = await this.marketplaces.contractViews.get_permissions({ permittee: walletProvider.walletPHK(), owner: owner, lot_id: place_id }).executeView({ viewCaller: this.marketplaces.address });

        return new PlacePermissions(permissionsRes.toNumber());
    }

    public async getPlacePermissions(walletProvider: ITezosWalletProvider, place_id: number, owner: string): Promise<PlacePermissions> {
        // check if wallet is connected before calling walletPHK
        if (!walletProvider.isWalletConnected()) return new PlacePermissions(PlacePermissions.permissionNone);

        if (walletProvider.walletPHK() === owner) return new PlacePermissions(PlacePermissions.permissionFull);

        return this.queryPlacePermissions(walletProvider, place_id, owner);
    }

    public async mintItem(walletProvider: ITezosWalletProvider, item_metadata_url: string, royalties: number, amount: number, callback?: (completed: boolean) => void) {
        const minterWallet = await walletProvider.tezosToolkit().wallet.at(Conf.minter_contract);

        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("mintItem: No wallet connected");

        const contributors: MichelsonMap<string, any> = new MichelsonMap();
        contributors.set(walletProvider.walletPHK(), { relative_royalties: 1000, role: "minter" });

        try {
            const mint_item_op = await minterWallet.methodsObject.mint_Item({
                address: walletProvider.walletPHK(),
                amount: amount,
                royalties: Math.floor(royalties * 10), // royalties in the minter contract are in permille
                contributors: contributors,
                metadata: char2Bytes(item_metadata_url)
            }).send();

            this.handleOperation(walletProvider, mint_item_op, callback);
        }
        catch {
            if(callback) callback(false);
        }
    }

    public async getItem(walletProvider: ITezosWalletProvider, place_id: number, item_id: number, issuer: string, xtz_per_item: number, callback?: (completed: boolean) => void) {
        const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.world_contract);

        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("getItem: No wallet connected");

        try {
            const get_item_op = await marketplacesWallet.methodsObject.get_item({
                lot_id: place_id, item_id: item_id, issuer: issuer
            }).send({ amount: xtz_per_item, mutez: false });

            this.handleOperation(walletProvider, get_item_op, callback);
        }
        catch {
            if(callback) callback(false);
        }
    }

    // TODO map or array of item_id to item_data.
    public async setItemData(walletProvider: ITezosWalletProvider, place_id: number, item_id: number, item_data: string, callback?: (completed: boolean) => void) {
        const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.world_contract);

        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("getItem: No wallet connected");

        try {
            const get_item_op = await marketplacesWallet.methodsObject.set_item_data({
                lot_id: place_id, update_list: [{ item_id: item_id, item_data: item_data }]
            }).send();

            this.handleOperation(walletProvider, get_item_op, callback);
        }
        catch {
            if(callback) callback(false);
        }
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
            Logging.InfoDev("place items outdated, reading from chain");

            const result = await this.marketplaces.contractViews.get_place_data(place_id).executeView({ viewCaller: this.marketplaces.address });

            const michelson_map = (result.stored_items as MichelsonMap<string, MichelsonMap<BigNumber, object>>);
            const flattened_item_data: { item_id: BigNumber; issuer: string, data: object }[] = [];
            for (const [issuer, issuer_items] of michelson_map.entries()) {
                for (const [item_id, item] of issuer_items.entries()) {
                    flattened_item_data.push({ item_id: item_id, issuer: issuer, data: item });
                }
            }

            const place_data = { stored_items: flattened_item_data, place_props: result.place_props }

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

    public async savePlaceProps(walletProvider: ITezosWalletProvider, groundColor: string, place_id: number, owner: string, callback?: (completed: boolean) => void) {
        const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.world_contract);

        // owner is optional.
        let params: any = { lot_id: place_id, props: groundColor };
        if(owner) params.owner = owner;

        try {
            const save_props_op = await marketplacesWallet.methodsObject.set_place_props(params).send();

            this.handleOperation(walletProvider, save_props_op, callback);
        }
        catch {
            if(callback) callback(false);
        }
    }

    public async saveItems(walletProvider: ITezosWalletProvider, remove: Node[], add: Node[], place_id: number, owner: string, callback?: (completed: boolean) => void) {
        const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.world_contract);
        const itemsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.item_contract);

        const wallet_phk = walletProvider.walletPHK();

        // build remove item map
        const remove_item_map: MichelsonMap<string, BigNumber[]> = new MichelsonMap();
        remove.forEach((item) => {
            const metadata = item.metadata as InstanceMetadata;

            if (remove_item_map.has(metadata.issuer))
                remove_item_map.get(metadata.issuer)!.push(metadata.id);
            else
                remove_item_map.set(metadata.issuer, [metadata.id]);
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
            const euler_angles = rot.toEulerAngles();
            // 1 byte format, 3 floats for euler angles, 3 floats pos, 1 float scale = 15 bytes
            const array = new Uint8Array(15);
            const view = new DataView(array.buffer);
            // format - version 0
            view.setUint8(0, 0);
            // quat
            setFloat16(view, 1, euler_angles.x);
            setFloat16(view, 3, euler_angles.y);
            setFloat16(view, 5, euler_angles.z);
            // pos
            setFloat16(view, 7, mesh.position.x);
            setFloat16(view, 9, mesh.position.y);
            setFloat16(view, 11, mesh.position.z);
            // scale
            setFloat16(view, 13, Math.abs(mesh.scaling.x));
            const item_data = toHexString(array);

            add_item_list.push({ item: { token_id: token_id, token_amount: item_amount, mutez_per_token: item_price, item_data: item_data } });

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
        if (remove_item_map.size > 0) batch.with([{
            kind: OpKind.TRANSACTION,
            ...marketplacesWallet.methodsObject.remove_items({
                lot_id: place_id, remove_map: remove_item_map, owner: owner
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

        try {
            const batch_op = await batch.send();

            this.handleOperation(walletProvider, batch_op, callback);
        }
        catch {
            if(callback) callback(false);
        }
    }

    public handleOperation(walletProvider: ITezosWalletProvider, op: TransactionWalletOperation | BatchWalletOperation, callback?: (completed: boolean) => void) {
        walletProvider.addWalletOperation(op.opHash);
        op.confirmation().then((result) => {
            walletProvider.walletOperationDone(op.opHash, result.completed);
            if (callback) callback(result.completed);
        }).catch((reason: any) => {
            walletProvider.walletOperationDone(op.opHash, false, reason.message);
            if (callback) callback(false);
        });
    }
}

export default new Contracts();
