import { DataStorage, Mesh, Node, Quaternion } from "@babylonjs/core";
import { Contract, TezosToolkit } from "@taquito/taquito";
import { TempleWallet } from "@temple-wallet/dapp";
import axios from 'axios';
import Conf from "../Config";
import { toHexString } from "./Utils";
import {
  Float16Array, isFloat16Array,
  getFloat16, setFloat16,
  hfround,
} from "@petamoriken/float16";
//import { Tzip16Module, tzip16, bytes2Char } from '@taquito/tzip16';

class Contracts {
    private tk: TezosToolkit;
    private marketplaces: Contract | null;

    constructor() {
        //this.tk = new TezosToolkit("https://api.tez.ie/rpc/mainnet");
        this.tk = new TezosToolkit(Conf.tezos_node);
        this.marketplaces = null;
        //this.tk.addExtension(new Tzip16Module());
    }

    public async initWallet() {
      console.log("trying to connect wallet");
      const available = await TempleWallet.isAvailable();
      if (!available) {
        throw new Error("Temple Wallet not installed");
      }

      const wallet = new TempleWallet('TezlandApp');
      await wallet.connect({ name: "sandboxlocal", rpc: Conf.tezos_node });
      this.tk.setWalletProvider(wallet);
      //this.tk.setProvider({ signer: signer });
    }

    public async getItemsForPlaceView(place_id: number): Promise<any> {
      // use get_stored_items on-chain view.
      if(!this.marketplaces)
        this.marketplaces = await this.tk.contract.at(Conf.marketplaces_contract);

      const stSeqKey = "placeSeq" + place_id;
      const stItemsKey = "placeItems" + place_id;

      // Read sequence number from storage and contract
      const placeSequenceStore = DataStorage.ReadString(stSeqKey, "");
      const seqRes = await this.marketplaces.contractViews.get_place_seqnum(place_id).executeView({viewCaller: this.marketplaces.address});
      
      // If they are not the same, reload from blockchain
      if(placeSequenceStore !== seqRes) {
        console.log("place items outdates, reading from chain");
        //console.log(this.marketplaces.contractViews);
        //console.log(this.marketplaces.contractViews.get_stored_items().getSignature());
        const result = await this.marketplaces.contractViews.get_stored_items(place_id).executeView({viewCaller: this.marketplaces.address});
        //console.log(result);

        const foreachPairs: { id: number; data: object }[] = [];
        result.forEach((val: object, key: number) => {
          foreachPairs.push({ id: key, data: val });
        });

        DataStorage.WriteString(stItemsKey, JSON.stringify(foreachPairs));
        DataStorage.WriteString(stSeqKey, seqRes);

        return foreachPairs;
      } else { // Otherwise load items from storage
        console.log("reading place from local storage");
        const placeItemsStore = DataStorage.ReadString(stItemsKey, "");

        return JSON.parse(placeItemsStore);
      }

      //return result; // as MichelsonMap<MichelsonTypeNat, any>;
    }

    public async saveItems(remove: Node[], add: Node[], place_id: number) {
      const marketplacesWallet = await this.tk.wallet.at(Conf.marketplaces_contract);

      // TODO: removals

      // TODO: decide if items should be transfered or not

      // TODO: add_operator for items on sale

      // TODO: remove_operator for removed items?

      const add_item_list = new Array();
      add.forEach( (item) => {
        const mesh = item as Mesh;
        const item_id = mesh.metadata.itemId
        const rot = mesh.rotationQuaternion ? mesh.rotationQuaternion : new Quaternion();
        // 4 floats for quat, 1 float scale, 3 floats pos = 16 bytes
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

        add_item_list.push({token_amount: 1, token_id: item_id, xtz_per_token: 1000000, item_data: item_data});
      });

      const place_items_op = await marketplacesWallet.methodsObject.place_items({
        lot_id: place_id, item_list: add_item_list
      }).send();
      await place_items_op.confirmation();
      //console.log('Operation hash:', place_items_op.hash);
    }

    /*public async getItemsForPlaceBCD(place_id: number): Promise<any> {
        // todo: figure out how to hash key. this is hardcoded for key 'nat: 0'
        const key_hash = 'expruh4nG4YxN8sgCGLd6cHuCYZCeunSKp3MXVkKD8JXXteMbqssdA';
        // for now use better call dev. until views are available in taquito.
        return axios.get(`${Conf.bcd_url}/v1/bigmap/${Conf.tezos_network}/14/keys/${key_hash}`).then(function(data) {
            // this is our map of stored items.
            //console.log(data.data.values[0]);
            return data.data.values[0].value.children[1].children;
        });
    }*/

    /*this.tk.contract.at(places_contract, tzip16)
        .then((contract) => {
            //let methods = contract.parameterSchema.ExtractSignatures();
            //console.log(JSON.stringify(methods, null, 2));
            return contract.tzip16().metadataViews();
        })
        .then(views => {
            console.log(`The following view names were found in the metadata: ${Object.keys(views)}`);
            /*return views.someJson().executeView()
        }).then(result => {
            console.log(`Result of the view someJson: ${result}`);
            console.log(`Transform result to char: ${bytes2Char(result)}`);* /
        })
        .catch((error) => console.log(error));*/

  /*public initUI() {
    $("#show-balance-button").bind("click", () =>
      this.getBalance($("#address-input").val())
    );
  }

  private showError(message: string) {
    $("#balance-output").removeClass().addClass("hide");
    $("#error-message")
      .removeClass()
      .addClass("show")
      .html("Error: " + message);
  }

  private showBalance(balance: number) {
    $("#error-message").removeClass().addClass("hide");
    $("#balance-output").removeClass().addClass("show");
    $("#balance").html(balance);
  }

  private getBalance(address: string) {
    this.tk.rpc
      .getBalance(address)
      .then(balance => this.showBalance(balance.toNumber() / 1000000))
      .catch(e => this.showError("Address not found"));
  }*/
}

export default new Contracts();
