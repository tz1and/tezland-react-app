import { Mesh, Node, Quaternion } from "@babylonjs/core";
import { Contract, OpKind } from "@taquito/taquito";
import Conf from "../Config";
import { tezToMutez, toHexString } from "./Utils";
import { setFloat16 } from "@petamoriken/float16";
import { char2Bytes } from '@taquito/utils'
import axios from "axios";
import { Logging } from "../utils/Logging";
import Metadata from "../world/Metadata";
import { InstanceMetadata } from "../world/Place";
import BigNumber from "bignumber.js";
import { ITezosWalletProvider } from "../components/TezosWalletContext";


export class Contracts {
    private marketplaces: Contract | null;
    private places: Contract | null;
    private minter: Contract | null;

    constructor() {
        this.marketplaces = null;
        this.places = null;
        this.minter = null;
    }

    public async getPlaceOwner(place_id: number): Promise<string> {
      // todo: use fetch?
      const responseP = await axios.get(`${Conf.bcd_url}/v1/contract/${Conf.tezos_network}/${Conf.place_contract}/transfers?token_id=${place_id}&size=1`);
      const transferInfo = responseP.data;

      if(transferInfo.total > 0) return transferInfo.transfers[0].to;

      return "";
    }

    private async isPlaceOwner(walletProvider: ITezosWalletProvider, place_id: number): Promise<boolean> {
      // check if wallet is connected before calling walletPHK
      if(!walletProvider.isWalletConnected()) return false;

      if(!this.places)
        this.places = await walletProvider.tezosToolkit().contract.at(Conf.place_contract);

      // use get_balance on-chain view.
      const balanceRes = await this.places.contractViews.get_balance({ owner: walletProvider.walletPHK(), token_id: place_id }).executeView({viewCaller: this.places.address});

      return !balanceRes.isZero();
    }

    private async isPlaceOperator(walletProvider: ITezosWalletProvider, place_id: number, owner: string): Promise<boolean> {
      // check if wallet is connected before calling walletPHK
      if(!walletProvider.isWalletConnected()) return false;

      if(!this.places)
        this.places = await walletProvider.tezosToolkit().contract.at(Conf.place_contract);

      // use is_operator on-chain view.
      const isOperatorRes = await this.places.contractViews.is_operator({ operator: walletProvider.walletPHK(), owner: owner, token_id: place_id }).executeView({viewCaller: this.places.address});

      return isOperatorRes;
    }

    public async isPlaceOwnerOrOperator(walletProvider: ITezosWalletProvider, place_id: number, owner: string): Promise<boolean> {
      // check if wallet is connected before calling walletPHK
      if(!walletProvider.isWalletConnected()) return false;

      if(walletProvider.walletPHK() === owner) return true;

      return this.isPlaceOperator(walletProvider, place_id, owner);
    }

    public async mintItem(walletProvider: ITezosWalletProvider, item_metadata_url: string, royalties: number, amount: number) {
      const minterWallet = await walletProvider.tezosToolkit().wallet.at(Conf.minter_contract);

      // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
      if(!walletProvider.isWalletConnected()) throw new Error("mintItem: No wallet connected");

      const mint_item_op = await minterWallet.methodsObject.mint_Item({
        address: walletProvider.walletPHK(),
        amount: amount,
        royalties: Math.floor(royalties * 10), // royalties in the minter contract are in permille
        metadata: char2Bytes(item_metadata_url)
      }).send();
      
      await mint_item_op.confirmation();
    }

    public async getItem(walletProvider: ITezosWalletProvider, place_id: number, item_id: number, xtz_per_item: number) {
      const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.marketplaces_contract);

      //console.log(place_id, item_id, xtz_per_item);

      // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
      if(!walletProvider.isWalletConnected()) throw new Error("getItem: No wallet connected");

      const get_item_op = await marketplacesWallet.methodsObject.get_item({
        lot_id: place_id, item_id: item_id
      }).send({ amount: xtz_per_item, mutez: false });
      
      await get_item_op.confirmation();
    }

    public async getItemsForPlaceView(walletProvider: ITezosWalletProvider, place_id: number): Promise<any> {
      // use get_stored_items on-chain view.
      if(!this.marketplaces)
        this.marketplaces = await walletProvider.tezosToolkit().contract.at(Conf.marketplaces_contract);

      const stSeqKey = "placeSeq";
      const stItemsKey = "placeItems";

      // Read sequence number from storage and contract
      const placeSequenceStore = await Metadata.Storage.loadObject(place_id, stSeqKey);
      const seqRes = await this.marketplaces.contractViews.get_place_seqnum(place_id).executeView({viewCaller: this.marketplaces.address});
      
      // If they are not the same, reload from blockchain
      if(placeSequenceStore !== seqRes) {
        Logging.InfoDev("place items outdated, reading from chain")

        const result = await this.marketplaces.contractViews.get_stored_items(place_id).executeView({viewCaller: this.marketplaces.address});

        const foreachPairs: { id: number; data: object }[] = [];
        result.stored_items.forEach((val: object, key: number) => {
          foreachPairs.push({ id: key, data: val });
        });

        const place_data = { stored_items: foreachPairs, place_props: result.place_props }

        // TODO: await save?
        Metadata.Storage.saveObject(place_id, stItemsKey, place_data);
        Metadata.Storage.saveObject(place_id, stSeqKey, seqRes);

        return place_data;
      } else { // Otherwise load items from storage
        Logging.InfoDev("reading place from local storage")
        
        const placeItemsStore = await Metadata.Storage.loadObject(place_id, stItemsKey);

        return placeItemsStore;
      }

      //return result; // as MichelsonMap<MichelsonTypeNat, any>;
    }

    public async saveItems(walletProvider: ITezosWalletProvider, remove: Node[], add: Node[], place_id: number, owner: string) {
      const marketplacesWallet = await walletProvider.tezosToolkit().wallet.at(Conf.marketplaces_contract);
      const itemsWallet = await walletProvider.tezosToolkit().wallet.at(Conf.item_contract);

      // TODO: removals

      const wallet_phk = walletProvider.walletPHK();

      // build remove item list
      const remove_item_list: BigNumber[] = [];
      remove.forEach( (item) => {
        const metadata = item.metadata as InstanceMetadata;
        remove_item_list.push(metadata.id);
      });

      // build add item list
      const add_item_list: object[] = [];
      const item_set = new Set<BigNumber>();
      add.forEach( (item) => {
        const mesh = item as Mesh;
        const metadata = mesh.metadata as InstanceMetadata;
        const item_id = metadata.itemTokenId;
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

        add_item_list.push({item: {token_id: item_id, token_amount: item_amount, xtz_per_token: item_price, item_data: item_data}});

        item_set.add(item_id);
      });

      // build operator add/remove lists
      const operator_adds: object[] = [];
      const operator_removes: object[] = [];

      item_set.forEach((item_id) => {
        operator_adds.push({
          add_operator: {
              owner: wallet_phk,
              operator: marketplacesWallet.address,
              token_id: item_id
          }
        });
  
        operator_removes.push({
          remove_operator: {
              owner: wallet_phk,
              operator: marketplacesWallet.address,
              token_id: item_id
          }
        });
      });

      // prepare batch
      const batch = walletProvider.tezosToolkit().wallet.batch();
      
      if(operator_adds.length > 0) batch.with([{
        kind: OpKind.TRANSACTION,
        ...itemsWallet.methods.update_operators(operator_adds).toTransferParams()
      }]);

      // removals first. because of item limit.
      if(remove_item_list.length > 0) batch.with([{
        kind: OpKind.TRANSACTION,
        ...marketplacesWallet.methodsObject.remove_items({
          lot_id: place_id, item_list: remove_item_list, owner: owner
        }).toTransferParams()
      }]);

      if(add_item_list.length > 0) batch.with([{
        kind: OpKind.TRANSACTION,
        ...marketplacesWallet.methodsObject.place_items({
          lot_id: place_id, item_list: add_item_list, owner: owner
        }).toTransferParams()
      }]);

      if(operator_removes.length > 0) batch.with([{
        kind: OpKind.TRANSACTION,
        ...itemsWallet.methods.update_operators(operator_removes).toTransferParams()
      }]);

      const batch_op = await batch.send();
      await batch_op.confirmation();
      //console.log('Operation hash:', place_items_op.hash);
    }
}

export default new Contracts();
