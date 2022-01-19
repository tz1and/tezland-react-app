import { DataStorage, Mesh, Node, Quaternion } from "@babylonjs/core";
import { Contract, OpKind, TezosToolkit, Wallet } from "@taquito/taquito";
//import { InMemorySigner } from "@taquito/signer";
import { TempleWallet } from "@temple-wallet/dapp";
import Conf from "../Config";
import { isDev, tezToMutez, toHexString } from "./Utils";
import { setFloat16 } from "@petamoriken/float16";
import { char2Bytes } from '@taquito/utils'
import axios from "axios";


class Contracts {
    private tk: TezosToolkit;
    private marketplaces: Contract | null;
    private places: Contract | null;
    private minter: Contract | null;

    constructor() {
        //this.tk = new TezosToolkit("https://api.tez.ie/rpc/mainnet");
        this.tk = new TezosToolkit(Conf.tezos_node);

        // NOTE: these are KNOWN account keys.
        // alice: edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq
        // bob: edsk3RFfvaFaxbHx8BMtEW1rKQcPtDML3LXjNqMNLCzC3wLC1bWbAt
        //InMemorySigner.fromSecretKey('edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq').then((signer) => {
        //  this.tk.setProvider({signer});
        //})

        this.marketplaces = null;
        this.places = null;
        this.minter = null;
        //this.tk.addExtension(new Tzip16Module());
    }

    // A convenience function to check if a wallet (or signer) is set up/connected.
    public async isWalletConnected(): Promise<boolean> {
      try {
        await this.walletPHK();
        return true;
      }
      catch {
        return false;
      }
    }

    public async walletPHK(): Promise<string> {
      return this.tk.wallet.pkh();
    }

    public wallet(): Wallet {
      return this.tk.wallet;
    }

    public async initWallet() {
      if(isDev()) console.log("trying to connect wallet");
      //const available = await TempleWallet.isAvailable();
      //if (!available) {
      //  throw new Error("Temple Wallet not installed");
      //}

      const wallet = new TempleWallet(isDev() ? 'TezlandApp-dev': 'TezlandApp');
      await wallet.connect({ name: "sandboxlocal", rpc: Conf.tezos_node });
      this.tk.setWalletProvider(wallet);
      //this.tk.setProvider({ signer: signer });
    }

    public async getPlaceOwner(place_id: number): Promise<string> {
      const responseP = await axios.get(`${Conf.bcd_url}/v1/contract/${Conf.tezos_network}/${Conf.place_contract}/transfers?token_id=${place_id}&size=1`);
      const transferInfo = responseP.data;

      if(transferInfo.total > 0) return transferInfo.transfers[0].to;

      return "";
    }

    private async isPlaceOwner(place_id: number): Promise<boolean> {
      // check if wallet is connected before calling walletPHK
      if(!await this.isWalletConnected()) return false;

      if(!this.places)
        this.places = await this.tk.contract.at(Conf.place_contract);

      // use get_balance on-chain view.
      const balanceRes = await this.places.contractViews.get_balance({ owner: await this.walletPHK(), token_id: place_id }).executeView({viewCaller: this.places.address});

      return !balanceRes.isZero();
    }

    private async isPlaceOperator(place_id: number, owner: string): Promise<boolean> {
      // check if wallet is connected before calling walletPHK
      if(!await this.isWalletConnected()) return false;

      if(!this.places)
        this.places = await this.tk.contract.at(Conf.place_contract);

      // use is_operator on-chain view.
      const isOperatorRes = await this.places.contractViews.is_operator({ operator: await this.walletPHK(), owner: owner, token_id: place_id }).executeView({viewCaller: this.places.address});

      console.log(isOperatorRes);

      return isOperatorRes;
    }

    public async isPlaceOwnerOrOperator(place_id: number, owner: string): Promise<boolean> {
      // check if wallet is connected before calling walletPHK
      if(!await this.isWalletConnected()) return false;

      if(await this.walletPHK() === owner) return true;

      return this.isPlaceOperator(place_id, owner);
    }

    public async mintItem(item_metadata_url: string, royalties: number, amount: number) {
      const minterWallet = await this.tk.wallet.at(Conf.minter_contract);

      // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
      if(!await this.isWalletConnected()) throw new Error("mintItem: No wallet connected");

      const mint_item_op = await minterWallet.methodsObject.mint_Item({
        address: await this.walletPHK(),
        amount: amount,
        royalties: Math.floor(royalties * 10), // royalties in the minter contract are in permille
        metadata: char2Bytes(item_metadata_url)
      }).send();
      
      await mint_item_op.confirmation();
    }

    public async getItem(place_id: number, item_id: number, xtz_per_item: number) {
      const marketplacesWallet = await this.tk.wallet.at(Conf.marketplaces_contract);

      // note: this is also checked in MintForm, probably don't have to recheck, but better safe.
      if(!await this.isWalletConnected()) throw new Error("getItem: No wallet connected");

      const get_item_op = await marketplacesWallet.methodsObject.get_item({
        lot_id: place_id, item_id: item_id
      }).send({ amount: xtz_per_item, mutez: false });
      
      await get_item_op.confirmation();
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

    public async saveItems(remove: Node[], add: Node[], place_id: number, owner: string) {
      const marketplacesWallet = await this.tk.wallet.at(Conf.marketplaces_contract);
      const itemsWallet = await this.tk.wallet.at(Conf.item_contract);

      // TODO: removals

      const wallet_phk = await this.walletPHK();

      // build remove item list
      const remove_item_list: number[] = [];
      remove.forEach( (item) => {
        remove_item_list.push(item.metadata.id);
      });

      // build add item list
      const add_item_list: object[] = [];
      const item_set = new Set<number>();
      add.forEach( (item) => {
        const mesh = item as Mesh;
        const item_id = mesh.metadata.itemTokenId;
        const item_amount = mesh.metadata.itemAmount;
        const item_price = tezToMutez(mesh.metadata.xtzPerItem);
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
      const batch = this.wallet().batch();
      
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
