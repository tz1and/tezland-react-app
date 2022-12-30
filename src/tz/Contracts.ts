import { Contract, MichelCodecPacker, MichelsonMap, OpKind, PollingSubscribeProvider, TransactionWalletOperation } from "@taquito/taquito";
import { MichelsonV1Expression } from "@taquito/rpc";
import Conf from "../Config";
import { tezToMutez, toHexString } from "../utils/Utils";
import { char2Bytes } from '@taquito/utils'
import Metadata from "../world/Metadata";
import BasePlaceNode, { PlacePermissions, PlaceData, PlaceItemData, PlaceKey, PlaceSequenceNumbers } from "../world/nodes/BasePlaceNode";
import ItemNode from "../world/nodes/ItemNode";
import BigNumber from "bignumber.js";
import { ITezosWalletProvider } from "../components/TezosWalletContext";
import { BatchWalletOperation } from "@taquito/taquito/dist/types/wallet/batch-operation";
import { Logging } from "../utils/Logging";
import { SHA3 } from 'sha3';
import assert from "assert";
import { ItemDataWriter } from "../utils/ItemData";
import { grapphQLUser } from "../graphql/user";
import TokenKey from "../utils/TokenKey";


export const ALL_WORLD_EP_NAMES = ["get_item", "place_items", "update_place", "remove_items", "set_item_data"];


type PlaceLimits = {
    chunk_limit: number;
    chunk_item_limit: number
}


export class Contracts {
    // TODO: should be private? use get_world_contract_read!
    public worldContract: Contract | null;
    private places: Contract | null;

    private allowedPlaceTokens = new Map<String, PlaceLimits>()

    constructor() {
        this.worldContract = null;
        this.places = null;
    }

    public async subscribeToPlaceChanges(walletProvider: ITezosWalletProvider) {
        const world_contract = await this.get_world_contract_write(walletProvider);

        walletProvider.tezosToolkit().setStreamProvider(walletProvider.tezosToolkit().getFactory(PollingSubscribeProvider)({
            shouldObservableSubscriptionRetry: true,
            pollingIntervalMilliseconds: 5000 // NOTE: getting random failures with 20000
        }));

        try {
            const placesOperation = {
                and: [{ destination: world_contract.address }, { kind: 'transaction' }]
            }

            const sub = walletProvider.tezosToolkit().stream.subscribeOperation(placesOperation);
            return sub;
        }
        catch (e) {
            Logging.Error(e);
        }

        return;
    }

    public async getPlaceOwner(place_key: PlaceKey): Promise<string> {
        // TODO: use get_owner view?
        try {
            const data = await grapphQLUser.getPlaceOwner({id: place_key.id, fa2: place_key.fa2});
            
            assert(data.placeTokenHolder[0]);
            return data.placeTokenHolder[0].holderId;
        } catch(e: any) {
            Logging.InfoDev("failed to get place owner:", e);
            return "";
        }
    }

    // Note: unused.
    /*private async isPlaceOwner(walletProvider: ITezosWalletProvider, place_key): Promise<boolean> {
      // check if wallet is connected before calling walletPHK
      if (!walletProvider.isWalletConnected()) return false;

      if(!this.places)
        this.places = await walletProvider.tezosToolkit().contract.at(Conf.place_contract);

      // use get_balance on-chain view.
      const balanceRes = await this.places.contractViews.get_balance({ owner: walletProvider.walletPHK(), token_id: place_id }).executeView({viewCaller: this.places.address});

      return !balanceRes.isZero();
    }*/

    public async getWorldAllowedPlaceTokens(walletProvider: ITezosWalletProvider) {
        const current_world = await this.get_world_contract_read(walletProvider);

        const res: MichelsonMap<string, any> = await current_world.contractViews.get_allowed_place_tokens().executeView({ viewCaller: current_world.address });

        this.allowedPlaceTokens.clear();
        for (const [key, value] of res.entries()) {
            this.allowedPlaceTokens.set(key, {
                chunk_limit: value.chunk_limit.toNumber(),
                chunk_item_limit: value.chunk_item_limit.toNumber()
            });
        }
    }

    public async get_world_contract_read(walletProvider: ITezosWalletProvider) {
        if (!this.worldContract)
            this.worldContract = await walletProvider.tezosToolkit().contract.at(Conf.world_contract);

        return this.worldContract;
    }

    private async get_world_contract_write(walletProvider: ITezosWalletProvider) {
        return walletProvider.tezosToolkit().wallet.at(Conf.world_contract);
    }

    // TODO: place_key
    private async queryPlacePermissions(walletProvider: ITezosWalletProvider, place_key: PlaceKey, owner: string): Promise<PlacePermissions> {
        // check if wallet is connected before calling walletPHK
        if (!walletProvider.isWalletConnected()) return new PlacePermissions(PlacePermissions.permissionNone);

        const current_world = await this.get_world_contract_read(walletProvider);

        // use is_operator on-chain view.
        const permissionsRes: BigNumber = await current_world.contractViews.get_permissions({ permittee: walletProvider.walletPHK(), owner: owner, place_key: place_key }).executeView({ viewCaller: current_world.address });

        return new PlacePermissions(permissionsRes.toNumber());
    }

    // TODO: place_key
    public async getPlacePermissions(walletProvider: ITezosWalletProvider, place_key: PlaceKey, owner: string): Promise<PlacePermissions> {
        // check if wallet is connected before calling walletPHK
        if (!walletProvider.isWalletConnected()) return new PlacePermissions(PlacePermissions.permissionNone);

        if (walletProvider.walletPHK() === owner) return new PlacePermissions(PlacePermissions.permissionFull);

        return this.queryPlacePermissions(walletProvider, place_key, owner);
    }

    public async addPlacePermissions(walletProvider: ITezosWalletProvider, owner: string, place_key: PlaceKey, permittee: string, permissions: number, callback?: (completed: boolean) => void) {
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("addPlacePermissions: No wallet connected");

        const current_world = await this.get_world_contract_write(walletProvider);

        try {
            const set_permissions_op = await current_world.methodsObject.set_permissions([{
                add: {
                    owner: owner,
                    permittee: permittee,
                    place_key: place_key,
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

    public async removePlacePermissions(walletProvider: ITezosWalletProvider, owner: string, place_key: PlaceKey, permittee: string, callback?: (completed: boolean) => void) {
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("removePlacePermissions: No wallet connected");

        const current_world = await this.get_world_contract_write(walletProvider);

        try {
            const set_permissions_op = await current_world.methodsObject.set_permissions([{
                remove: {
                    owner: owner,
                    permittee: permittee,
                    place_key: place_key
                }
            }]).send();

            this.handleOperation(walletProvider, set_permissions_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public async mintItem(walletProvider: ITezosWalletProvider, collection: string, item_metadata_url: string, royalties: [string, number][], amount: number, callback?: (completed: boolean) => void) {
        if (!walletProvider.isWalletConnected()) await walletProvider.connectWallet();

        const minterWallet = await walletProvider.tezosToolkit().wallet.at(Conf.minter_contract);

        const royalty_shares = new MichelsonMap<string, number>();
        // tz1and item royalties are in permille.
        for (const [k, v] of royalties) royalty_shares.set(k, Math.floor(v * 10));

        try {
            const is_public = collection === Conf.item_contract;

            const mint_params = {
                collection: collection,
                to_: walletProvider.walletPHK(),
                amount: amount,
                royalties: royalty_shares,
                metadata: char2Bytes(item_metadata_url)
            }

            const mint_item_op = is_public ? await minterWallet.methodsObject.mint_public(mint_params).send()
                : await minterWallet.methodsObject.mint_private(mint_params).send();

            this.handleOperation(walletProvider, mint_item_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public async burnItem(walletProvider: ITezosWalletProvider, tokenKey: TokenKey, amount: number, callback?: (completed: boolean) => void) {
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("burnItem: No wallet connected");

        const itemsWallet = await walletProvider.tezosToolkit().wallet.at(tokenKey.fa2);

        try {
            const burn_item_op = await itemsWallet.methodsObject.burn([{
                from_: walletProvider.walletPHK(),
                amount: amount,
                token_id: tokenKey.id
            }]).send();

            this.handleOperation(walletProvider, burn_item_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public async transferItem(walletProvider: ITezosWalletProvider, tokenKey: TokenKey, amount: number, to: string, callback?: (completed: boolean) => void) {
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("transferItem: No wallet connected");

        const itemsWallet = await walletProvider.tezosToolkit().wallet.at(tokenKey.fa2);

        try {
            const transfer_item_op = await itemsWallet.methodsObject.transfer([{
                from_: walletProvider.walletPHK(),
                txs: [{
                    to_: to,
                    amount: amount,
                    token_id: tokenKey.id
                }]
            }]).send();

            this.handleOperation(walletProvider, transfer_item_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public async getItem(walletProvider: ITezosWalletProvider, place_key: PlaceKey, chunk_id: number, item_id: number, fa2: string, issuer: string | null, xtz_per_item: number, callback?: (completed: boolean) => void) {
        if (!walletProvider.isWalletConnected()) await walletProvider.connectWallet();

        const current_world = await this.get_world_contract_write(walletProvider);

        const get_item_op = await current_world.methodsObject.get_item({
            place_key: place_key, chunk_id: chunk_id, item_id: item_id, fa2: fa2, issuer: issuer
        }).send({ amount: xtz_per_item, mutez: false });

        this.handleOperation(walletProvider, get_item_op, callback);
    }

    // TODO map or array of item_id to data.
    public async setItemData(walletProvider: ITezosWalletProvider, place_key: PlaceKey, item_id: number, data: string, callback?: (completed: boolean) => void) {
        // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
        if (!walletProvider.isWalletConnected()) throw new Error("getItem: No wallet connected");

        const current_world = await this.get_world_contract_write(walletProvider);

        try {
            const get_item_op = await current_world.methodsObject.set_item_data({
                place_key: place_key, update_list: [{ item_id: item_id, data: data }]
            }).send();

            this.handleOperation(walletProvider, get_item_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public async countExteriorPlacesView(walletProvider: ITezosWalletProvider): Promise<BigNumber> {
        if (!this.places)
            this.places = await walletProvider.tezosToolkit().contract.at(Conf.place_contract);

        return this.places.contractViews.count_tokens().executeView({ viewCaller: this.places.address });
    }

    public async getPlaceSeqNum(walletProvider: ITezosWalletProvider, place_key: PlaceKey): Promise<PlaceSequenceNumbers> {
        const current_world = await this.get_world_contract_read(walletProvider);

        const result = await current_world.contractViews.get_place_seqnum({place_key: place_key}).executeView({ viewCaller: current_world.address });

        const chunk_seqs = new Map<number, string>();
        // Flatten chunk seqence numbers into something serialisable.
        for (const [chunk_id, seq_num] of result.chunk_seqs.entries()) {
            chunk_seqs.set(chunk_id.toNumber(), seq_num);
        }

        return new PlaceSequenceNumbers(result.place_seq, chunk_seqs);
    }

    private async reproduceSeqHash(onchain_place_data: any): Promise<PlaceSequenceNumbers> {
        // reproduce sequence number from interaction_counter and next_id to prevent
        // it getting out of sync catastrophically with onchain.

        const chunkHashStorageType: MichelsonV1Expression = {
            prim: 'pair',
            args: [
                { prim: 'nat', annots: [ '%counter' ] },
                { prim: 'nat', annots: [ '%next_id' ] }
            ]
        };

        const placeHashStorageType: MichelsonV1Expression = {
            prim: 'nat', annots: [ '%counter' ]
        };

        const chunk_seqs = new Map<number, string>();
        const packer = new MichelCodecPacker();

        for (let [chunk_id, value] of onchain_place_data.chunks.entries()) {
            // NOTE: BigNumber converting string to exponential could bite us here...
            const chunkDataMichelson: MichelsonV1Expression = {
                "prim": "Pair",
                "args": [
                    {
                        "int": value.counter.toString()
                    },
                    {
                        "int": value.next_id.toString()
                    }
                ]
            };

            const packedChunkSeq = await packer.packData({ data: chunkDataMichelson, type: chunkHashStorageType })
            const chunkSeqHash = new SHA3(256).update(packedChunkSeq.packed, 'hex').digest('hex');
            chunk_seqs.set(chunk_id.toNumber(), chunkSeqHash);
        }

        // NOTE: BigNumber converting string to exponential could bite us here...
        const placeDataMichelson: MichelsonV1Expression = {
            "int": onchain_place_data.place.counter.toString()
        };

        const packedPlaceSeq = await packer.packData({ data: placeDataMichelson, type: placeHashStorageType })
        const placeSeqHash = new SHA3(256).update(packedPlaceSeq.packed, 'hex').digest('hex');

        return new PlaceSequenceNumbers(placeSeqHash, chunk_seqs);
    }

    // TODO: place_key
    public async getItemsForPlaceView(walletProvider: ITezosWalletProvider, place_key: PlaceKey): Promise<any> {
        // use get_place_data on-chain view.
        const current_world = await this.get_world_contract_read(walletProvider);

        Logging.InfoDev("Reading place data from chain", place_key.id);

        const result = await current_world.contractViews.get_place_data({place_key: place_key}).executeView({ viewCaller: current_world.address });

        const seqHash = await this.reproduceSeqHash(result);

        const chunks_map = (result.chunks as MichelsonMap<BigNumber, any>);
        const flattened_item_data: PlaceItemData[] = [];
        // For every chunk in the result
        for (const [chunk_id, chunk_data] of chunks_map.entries()) {
            // Get the item storage map
            // @ts-expect-error
            const storage_map = (chunk_data.storage as MichelsonMap<string | null, MichelsonMap<string, MichelsonMap<BigNumber, object>>>);

            // And flatten the item storage michelson map into something serialisable.
            for (const [issuer, issuer_items] of storage_map.entries()) {
                for (const [fa2, fa2_items] of issuer_items.entries()) {
                    for (const [item_id, item] of fa2_items.entries()) {
                        flattened_item_data.push({ chunk_id: chunk_id, item_id: item_id, issuer: issuer, fa2: fa2, data: item });
                    }
                }
            }
        }

        // We have to convert the place props michelson map into a regular map to be serialisable.
        const props_michelson_map = (result.place.props as MichelsonMap<string, string>);
        const place_props: Map<string, string> = new Map();
        for (const [key, value] of props_michelson_map.entries()) {
            place_props.set(key, value);
        }

        const place_data: PlaceData = {
            tokenId: place_key.id,
            contract: place_key.fa2,
            placeType: place_key.fa2,
            storedItems: flattened_item_data,
            placeProps: place_props,
            placeSeq: seqHash,
            itemsTo: result.place.items_to,
            valueTo: result.place.value_to
        };

        Metadata.Storage.saveObject("placeData", place_data);

        return place_data;
    }

    public async savePlaceProps(walletProvider: ITezosWalletProvider, groundColor: string, placeName: string, place_node: BasePlaceNode, callback?: (completed: boolean) => void) {
        // TODO: only save props that changed.
        const current_world = await this.get_world_contract_write(walletProvider);

        // owner is optional.
        const props_map = new MichelsonMap<string, string>();
        props_map.set('00', groundColor);
        props_map.set('01', placeName);
        let params: any = { place_key: place_node.placeKey, update: { props: [{add_props: props_map}] } };

        try {
            const save_props_op = await current_world.methodsObject.update_place(params).send();

            this.handleOperation(walletProvider, save_props_op, callback);
        }
        catch(e: any) {
            Logging.Error(e);
            if(callback) callback(false);
        }
    }

    public async saveItems(walletProvider: ITezosWalletProvider, remove: ItemNode[], add: ItemNode[], place_node: BasePlaceNode, callback?: (completed: boolean) => void) {
        const current_world = await this.get_world_contract_write(walletProvider);

        // build remove item map
        // Chunk, issuer, fa2, ids
        // @ts-expect-error
        const remove_item_map: MichelsonMap<BigNumber, MichelsonMap<string | null, MichelsonMap<string, BigNumber[]>>> = new MichelsonMap();
        remove.forEach((item) => {
            // @ts-expect-error
            let issuer_map: MichelsonMap<string | null, MichelsonMap<string, BigNumber[]>>;
            if (remove_item_map.has(item.chunkId))
                issuer_map = remove_item_map.get(item.chunkId)!;
            else {
                // @ts-expect-error
                issuer_map = new MichelsonMap();
                remove_item_map.set(item.chunkId, issuer_map)
            }

            let fa2_map: MichelsonMap<string, BigNumber[]>;
            if (issuer_map.has(item.issuer))
                fa2_map = issuer_map.get(item.issuer)!;
            else {
                fa2_map = new MichelsonMap();
                issuer_map.set(item.issuer, fa2_map)
            }

            let token_id_array: BigNumber[];
            if (fa2_map.has(item.tokenKey.fa2))
                token_id_array = fa2_map.get(item.tokenKey.fa2)!;
            else {
                token_id_array = [];
                fa2_map.set(item.tokenKey.fa2, token_id_array)
            }

            token_id_array.push(item.itemId);
        });

        // Build a map of chunk to item count.
        const chunk_item_counts = new Map<number, number>();
        assert(place_node.placeData);
        for(const item of place_node.placeData.storedItems) {
            const chunk_id = item.chunk_id.toNumber();
            chunk_item_counts.set(chunk_id, (() => {
                const res = chunk_item_counts.get(chunk_id);
                if (res) return res + 1;
                return 1;
            })())
        }

        // TODO: get limits from contract! Store them in world.
        const placeLimits = this.allowedPlaceTokens.get(place_node.placeKey.fa2);
        if (!placeLimits) throw new Error(`No place limits for ${place_node.placeKey.fa2}.`);

        // TODO: Could be improved by adding preference for finding chunks
        // that contain tokens of the same type!
        const getChunkIdForItem = (): BigNumber => {
            // Iterate over all (allocated) chunks to find a
            // free spot for the item.
            for (const [key, value] of chunk_item_counts) {
                if (value < placeLimits.chunk_item_limit) {
                    chunk_item_counts.set(key, value + 1);
                    return new BigNumber(key);
                }
            }

            // If we get here, all (allocated) chunks are full.
            // Find a chunk id that hasn't been allocated and
            // return it.
            if (chunk_item_counts.size >= placeLimits.chunk_limit)
                throw new Error("Place chunk and chunk item limit reached.")

            for (let chunk_id = 0; chunk_id < placeLimits.chunk_limit; ++chunk_id) {
                if (!chunk_item_counts.has(chunk_id)) {
                    chunk_item_counts.set(chunk_id, 1);
                    return new BigNumber(chunk_id);
                }
            }

            throw new Error("Something went horribly wrong finding a chunk for the item.")
        }

        // build add item list
        // Chunk, send_to_place, fa2, ids
        const add_item_map: MichelsonMap<BigNumber, MichelsonMap<boolean, MichelsonMap<string, object[]>>> = new MichelsonMap();
        const operator_map = new Map<string, Set<number>>();
        add.forEach((item) => {
            const chunkId = getChunkIdForItem();
            let send_to_place_map: MichelsonMap<boolean, MichelsonMap<string, object[]>>;
            if (add_item_map.has(chunkId))
                send_to_place_map = add_item_map.get(chunkId)!;
            else {
                send_to_place_map = new MichelsonMap();
                add_item_map.set(chunkId, send_to_place_map)
            }

            let fa2_map: MichelsonMap<string, object[]>;
            // TODO: item needs "send_to_place" property. Or maybe issuer == null?
            const send_to_place = item.placeOwned;
            if (send_to_place_map.has(send_to_place))
                fa2_map = send_to_place_map.get(send_to_place)!;
            else {
                fa2_map = new MichelsonMap();
                send_to_place_map.set(send_to_place, fa2_map)
            }

            // Add to operator map
            const token_operator_set = operator_map.get(item.tokenKey.fa2)
            if (token_operator_set) token_operator_set.add(item.tokenKey.id.toNumber());
            else operator_map.set(item.tokenKey.fa2, new Set([item.tokenKey.id.toNumber()]));

            let item_add_array: object[];
            if (fa2_map.has(item.tokenKey.fa2))
                item_add_array = fa2_map.get(item.tokenKey.fa2)!;
            else {
                item_add_array = [];
                fa2_map.set(item.tokenKey.fa2, item_add_array)
            }

            const tokenKey = item.tokenKey;
            const primary = item.primarySwap;
            const item_amount = item.itemAmount;
            const item_price = tezToMutez(item.xtzPerItem);

            const item_data = toHexString(ItemDataWriter.write(item));

            item_add_array.push({ item: { token_id: tokenKey.id, amount: item_amount, rate: item_price, data: item_data, primary: primary } });
        });

        // prepare batch
        const batch = walletProvider.tezosToolkit().wallet.batch();

        for (const [fa2, tokens] of operator_map) {
            // build operator add/remove lists
            const operator_adds: object[] = [];

            for (const token_id of tokens) {
                operator_adds.push({
                    operator: current_world.address,
                    token_id: token_id
                });
            }

            if (operator_adds.length > 0) {
                const currentItems = await walletProvider.tezosToolkit().wallet.at(fa2);

                batch.with([{
                    kind: OpKind.TRANSACTION,
                    ...currentItems.methodsObject.update_adhoc_operators({ add_adhoc_operators: operator_adds }).toTransferParams()
                }]);
            }
        }

        // removals first. because of item limit.
        if (remove_item_map.size > 0) batch.with([{
            kind: OpKind.TRANSACTION,
            ...current_world.methodsObject.remove_items({
                place_key: place_node.placeKey, remove_map: remove_item_map
            }).toTransferParams()
        }]);

        if (add_item_map.size > 0) batch.with([{
            kind: OpKind.TRANSACTION,
            ...current_world.methodsObject.place_items({
                place_key: place_node.placeKey, place_item_map: add_item_map
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
        op.confirmation(confirmations).then((result) => {
            op.status().then(status => {
                if (status === "applied") {
                    walletProvider.walletOperationDone(op.opHash, result.completed);
                    if (callback) callback(result.completed);
                }
                else throw new Error("Operation status: " + status);
            });
        }).catch((reason: any) => {
            walletProvider.walletOperationDone(op.opHash, false, reason.message);
            if (callback) callback(false);
        });
    }
}

export default new Contracts();
