import { DataStorage, Mesh, Node, Quaternion } from "@babylonjs/core";
import { Contract, TezosToolkit } from "@taquito/taquito";
import { TempleWallet } from "@temple-wallet/dapp";
import Conf from "../Config";
import { isDev, tezToMutez, toHexString } from "./Utils";
import { setFloat16 } from "@petamoriken/float16";
import { char2Bytes } from '@taquito/utils'
//import { Tzip16Module, tzip16, bytes2Char } from '@taquito/tzip16';

class Contracts {
    private tk: TezosToolkit;
    private marketplaces: Contract | null;
    private places: Contract | null;
    private minter: Contract | null;

    constructor() {
        //this.tk = new TezosToolkit("https://api.tez.ie/rpc/mainnet");
        this.tk = new TezosToolkit(Conf.tezos_node);
        this.marketplaces = null;
        this.places = null;
        this.minter = null;
        //this.tk.addExtension(new Tzip16Module());
    }

    public async walletPHK(): Promise<string> {
      return this.tk.wallet.pkh();
    }

    public async initWallet() {
      if(isDev()) console.log("trying to connect wallet");
      const available = await TempleWallet.isAvailable();
      if (!available) {
        throw new Error("Temple Wallet not installed");
      }

      const wallet = new TempleWallet('TezlandApp');
      await wallet.connect({ name: "sandboxlocal", rpc: Conf.tezos_node });
      this.tk.setWalletProvider(wallet);
      //this.tk.setProvider({ signer: signer });
    }

    public async isPlaceOwner(place_id: number): Promise<boolean> {
      // use get_balance on-chain view.
      if(!this.places)
        this.places = await this.tk.contract.at(Conf.place_contract);

      // TODO: walletPHK might fail.
      const balanceRes = await this.places.contractViews.get_balance({ owner: await this.walletPHK(), token_id: place_id }).executeView({viewCaller: this.places.address});

      return !balanceRes.isZero();
    }

    public async mintItem(item_metadata_url: string, royalties: number, amount: number) {
      const minterWallet = await this.tk.wallet.at(Conf.minter_contract);

      const mint_item_op = await minterWallet.methodsObject.mint_Item({
        address: await this.tk.wallet.pkh(),
        amount: amount,
        royalties: royalties,
        metadata: char2Bytes(item_metadata_url)
      }).send();
      
      await mint_item_op.confirmation();
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
        if(isDev()) console.log("place items outdated, reading from chain");

        const result = await this.marketplaces.contractViews.get_stored_items(place_id).executeView({viewCaller: this.marketplaces.address});

        const foreachPairs: { id: number; data: object }[] = [];
        result.forEach((val: object, key: number) => {
          foreachPairs.push({ id: key, data: val });
        });

        DataStorage.WriteString(stItemsKey, JSON.stringify(foreachPairs));
        DataStorage.WriteString(stSeqKey, seqRes);

        return foreachPairs;
      } else { // Otherwise load items from storage
        if(isDev()) console.log("reading place from local storage");
        
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

      const add_item_list: object[] = [];
      add.forEach( (item) => {
        const mesh = item as Mesh;
        const item_id = mesh.metadata.itemId;
        const item_amount = mesh.metadata.itemAmount;
        const item_price = tezToMutez(mesh.metadata.itemPrice);
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

        add_item_list.push({token_id: item_id, token_amount: item_amount, xtz_per_token: item_price, item_data: item_data});
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
