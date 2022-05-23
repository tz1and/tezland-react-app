import { Quaternion } from "@babylonjs/core";
import { Contract, MichelsonMap, OpKind, PollingSubscribeProvider, TransactionWalletOperation } from "@taquito/taquito";
import Conf from "../Config";
import { tezToMutez, toHexString } from "../utils/Utils";
import { packTo } from 'byte-data';
import { char2Bytes } from '@taquito/utils'
import Metadata, { StorageKey } from "../world/Metadata";
import { PlaceData, PlaceItemData, PlacePermissions } from "../world/PlaceNode";
import BigNumber from "bignumber.js";
import { ITezosWalletProvider } from "../components/TezosWalletContext";
import { BatchWalletOperation } from "@taquito/taquito/dist/types/wallet/batch-operation";
import { Logging } from "../utils/Logging";
import { fetchGraphQL } from "../ipfs/graphql";
import assert from "assert";
import ItemNode from "../world/ItemNode";


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

        walletProvider.tezosToolkit().setStreamProvider(walletProvider.tezosToolkit().getFactory(PollingSubscribeProvider)({
            shouldObservableSubscriptionRetry: true,
            pollingIntervalMilliseconds: 5000 // NOTE: getting random failures with 20000
        }));

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
        try {   
            const data = await fetchGraphQL(`
                query getPlaceOwner($id: bigint!) {
                    placeTokenHolder(limit: 1, where: {tokenId: {_eq: $id}}) {
                        holderId
                    }
                }`, "getPlaceOwner", { id: place_id });
            
            assert(data.placeTokenHolder[0]);
            return data.placeTokenHolder[0].holderId;
        } catch(e: any) {
            Logging.InfoDev("failed to get place owner:", e);
            return "";
        }
    }

    // Note: unused.
    /*private async isPlaceOwner(walletProvider: ITezosWalletProvider, place_id: number): Promise<boolean> {
      // check if wallet is connected before calling walletPHK
      if (!walletProvider.isWalletConnected()) return false;

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

    public async addPlacePermissions(walletProvider: ITezosWalletProvider, owner: string, token_id: number, permittee: string, permissions: number, callback?: (completed: boolean) => void) {
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("getItem: No wallet connected");

        const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.world_contract);

        try {
            const set_permissions_op = await marketplacesWallet.methodsObject.set_permissions([{
                add_permission: {
                    owner: owner,
                    permittee: permittee,
                    token_id: token_id,
                    perm: permissions
                }
            }]).send();

            this.handleOperation(walletProvider, set_permissions_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public async removePlacePermissions(walletProvider: ITezosWalletProvider, owner: string, token_id: number, permittee: string, callback?: (completed: boolean) => void) {
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("getItem: No wallet connected");

        const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.world_contract);

        try {
            const set_permissions_op = await marketplacesWallet.methodsObject.set_permissions([{
                remove_permission: {
                    owner: owner,
                    permittee: permittee,
                    token_id: token_id
                }
            }]).send();

            this.handleOperation(walletProvider, set_permissions_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public async mintItem(walletProvider: ITezosWalletProvider, item_metadata_url: string, royalties: number, amount: number, callback?: (completed: boolean) => void) {
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("mintItem: No wallet connected");

        const minterWallet = await walletProvider.tezosToolkit().wallet.at(Conf.minter_contract);

        const contributors = royalties === 0 ? [] : [
            { address: walletProvider.walletPHK(), relative_royalties: 1000, role: { minter: null } }
        ];

        try {
            const mint_item_op = await minterWallet.methodsObject.mint_Item({
                to_: walletProvider.walletPHK(),
                amount: amount,
                royalties: Math.floor(royalties * 10), // royalties in the minter contract are in permille
                contributors: contributors,
                metadata: char2Bytes(item_metadata_url)
            }).send();

            this.handleOperation(walletProvider, mint_item_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public async burnItem(walletProvider: ITezosWalletProvider, itemId: number, amount: number, callback?: (completed: boolean) => void) {
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("burnItem: No wallet connected");

        const itemsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.item_contract);

        try {
            const burn_item_op = await itemsWallet.methodsObject.burn([{
                from_: walletProvider.walletPHK(),
                amount: amount,
                token_id: itemId
            }]).send();

            this.handleOperation(walletProvider, burn_item_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public async transferItem(walletProvider: ITezosWalletProvider, itemId: number, amount: number, to: string, callback?: (completed: boolean) => void) {
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("transferItem: No wallet connected");

        const itemsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.item_contract);

        try {
            const transfer_item_op = await itemsWallet.methodsObject.transfer([{
                from_: walletProvider.walletPHK(),
                txs: [{
                    to_: to,
                    amount: amount,
                    token_id: itemId
                }]
            }]).send();

            this.handleOperation(walletProvider, transfer_item_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public async getItem(walletProvider: ITezosWalletProvider, place_id: number, item_id: number, issuer: string, xtz_per_item: number, callback?: (completed: boolean) => void) {
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("getItem: No wallet connected");

        const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.world_contract);

        try {
            const get_item_op = await marketplacesWallet.methodsObject.get_item({
                lot_id: place_id, item_id: item_id, issuer: issuer
            }).send({ amount: xtz_per_item, mutez: false });

            this.handleOperation(walletProvider, get_item_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    // TODO map or array of item_id to item_data.
    public async setItemData(walletProvider: ITezosWalletProvider, place_id: number, item_id: number, item_data: string, callback?: (completed: boolean) => void) {
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("getItem: No wallet connected");

        const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.world_contract);

        try {
            const get_item_op = await marketplacesWallet.methodsObject.set_item_data({
                lot_id: place_id, update_list: [{ item_id: item_id, item_data: item_data }]
            }).send();

            this.handleOperation(walletProvider, get_item_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public async countPlacesView(walletProvider: ITezosWalletProvider): Promise<BigNumber> {
        if (!this.places)
            this.places = await walletProvider.tezosToolkit().contract.at(Conf.place_contract);

        return this.places.contractViews.count_tokens().executeView({ viewCaller: this.places.address });
    }

    public async getPlaceSeqNum(walletProvider: ITezosWalletProvider, place_id: number): Promise<string> {
        if (!this.marketplaces)
            this.marketplaces = await walletProvider.tezosToolkit().contract.at(Conf.world_contract);

        return this.marketplaces.contractViews.get_place_seqnum(place_id).executeView({ viewCaller: this.marketplaces.address });
    }

    public async getItemsForPlaceView(walletProvider: ITezosWalletProvider, place_id: number, newSeqNum: string): Promise<any> {
        // use get_place_data on-chain view.
        if (!this.marketplaces)
            this.marketplaces = await walletProvider.tezosToolkit().contract.at(Conf.world_contract);

        Logging.InfoDev("Reading place data from chain", place_id);

        const result = await this.marketplaces.contractViews.get_place_data(place_id).executeView({ viewCaller: this.marketplaces.address });

        // We have to flatten the michelson map into something serialisable.
        const michelson_map = (result.stored_items as MichelsonMap<string, MichelsonMap<BigNumber, object>>);
        const flattened_item_data: PlaceItemData[] = [];
        for (const [issuer, issuer_items] of michelson_map.entries()) {
            for (const [item_id, item] of issuer_items.entries()) {
                flattened_item_data.push({ item_id: item_id, issuer: issuer, data: item });
            }
        }

        // We have to convert the michelson map into a regular map to be serialisable.
        const props_michelson_map = (result.place_props as MichelsonMap<string, string>);
        const place_props: Map<string, string> = new Map();
        for (const [key, value] of props_michelson_map.entries()) {
            place_props.set(key, value);
        }

        const place_data = { stored_items: flattened_item_data, place_props: place_props, place_seq: newSeqNum } as PlaceData;

        // TODO: await save?
        Metadata.Storage.saveObject(place_id, StorageKey.PlaceItems, place_data);

        return place_data;
    }

    public async savePlaceProps(walletProvider: ITezosWalletProvider, groundColor: string, placeName: string, place_id: number, owner: string, callback?: (completed: boolean) => void) {
        const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.world_contract);

        // owner is optional.
        const props_map = new MichelsonMap<string, string>();
        props_map.set('00', groundColor);
        props_map.set('01', placeName);
        let params: any = { lot_id: place_id, props: props_map };
        if(owner) params.owner = owner;

        try {
            const save_props_op = await marketplacesWallet.methodsObject.set_place_props(params).send();

            this.handleOperation(walletProvider, save_props_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public async saveItems(walletProvider: ITezosWalletProvider, remove: ItemNode[], add: ItemNode[], place_id: number, owner: string, callback?: (completed: boolean) => void) {
        const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.world_contract);
        const itemsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.item_contract);

        // build remove item map
        const remove_item_map: MichelsonMap<string, BigNumber[]> = new MichelsonMap();
        remove.forEach((item) => {
            if (remove_item_map.has(item.issuer))
                remove_item_map.get(item.issuer)!.push(item.itemId);
            else
                remove_item_map.set(item.issuer, [item.itemId]);
        });

        // build add item list
        const add_item_list: object[] = [];
        const item_set = new Set<number>();
        add.forEach((item) => {
            const token_id = item.tokenId;
            const item_amount = item.itemAmount;
            const item_price = tezToMutez(item.xtzPerItem);
            const rot = item.rotationQuaternion ? item.rotationQuaternion : new Quaternion();
            const euler_angles = rot.toEulerAngles();
            // 1 byte format, 3 floats for euler angles, 3 floats pos, 1 float scale = 15 bytes
            const array = new Uint8Array(15);
            // format - version 1
            packTo(1, { bits: 8, signed: false, be: true }, array, 0);
            // float data
            const type = { bits: 16, fp: true, be: true };
            // quat
            packTo(euler_angles.x, type, array, 1);
            packTo(euler_angles.y, type, array, 3);
            packTo(euler_angles.z, type, array, 5);
            // pos
            packTo(item.position.x, type, array, 7);
            packTo(item.position.y, type, array, 9);
            packTo(item.position.z, type, array, 11);
            // scale
            packTo(Math.abs(item.scaling.x), type, array, 13);
            const item_data = toHexString(array);

            add_item_list.push({ item: { token_id: token_id, token_amount: item_amount, mutez_per_token: item_price, item_data: item_data } });

            item_set.add(token_id.toNumber());
        });

        // build operator add/remove lists
        const operator_adds: object[] = [];

        item_set.forEach((token_id) => {
            operator_adds.push({
                operator: marketplacesWallet.address,
                token_id: token_id
            });
        });

        // prepare batch
        const batch = walletProvider.tezosToolkit().wallet.batch();

        if (operator_adds.length > 0) batch.with([{
            kind: OpKind.TRANSACTION,
            ...itemsWallet.methodsObject.update_adhoc_operators({ add_adhoc_operators: operator_adds }).toTransferParams()
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

        try {
            const batch_op = await batch.send();

            this.handleOperation(walletProvider, batch_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public handleOperation(walletProvider: ITezosWalletProvider, op: TransactionWalletOperation | BatchWalletOperation, callback?: (completed: boolean) => void, confirmations?: number) {
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
