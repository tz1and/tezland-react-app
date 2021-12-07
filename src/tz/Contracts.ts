import { MichelsonTypeInt, MichelsonTypeNat } from "@taquito/michel-codec";
import { Contract, ContractAbstraction, MichelsonMap, TezosToolkit } from "@taquito/taquito";
import axios from 'axios';
import Conf from "../Config";
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

    public async getItemsForPlaceView(place_id: number): Promise<MichelsonMap<MichelsonTypeNat, any>> {
      // use get_stored_items on-chain view.
      if(!this.marketplaces)
        this.marketplaces = await this.tk.contract.at(Conf.marketplaces_contract);
      
      //console.log(this.marketplaces.contractViews);
      //console.log(this.marketplaces.contractViews.get_stored_items().getSignature());
      const result = await this.marketplaces.contractViews.get_stored_items(place_id).executeView({viewCaller: this.marketplaces.address});
      //console.log(result);

      return result; // as MichelsonMap<MichelsonTypeNat, any>;
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
