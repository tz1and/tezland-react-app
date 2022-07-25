import { ITezosWalletProvider } from "../components/TezosWalletContext";
import Conf from "../Config";
import { grapphQLUser } from "../graphql/user";
import { Logging } from "../utils/Logging";
import { PlaceType } from "../world/nodes/BasePlaceNode";

export async function fetchGraphQL(query: string, query_name: string, variables?: any, api_url = Conf.hasura_url) {
    // NOTE:
    // HTTP caching with graphql is kinda broken, sort of. The response doesn't have the right headers set
    // for them to be cached. could maybe get around it by way of using GET requests in some cases.
    const result = await fetch(
        api_url,
        {
            method: "POST",
            body: JSON.stringify({
                query: query,
                variables: variables,
                operationName: query_name
            })
        }
    );

    const obj = await result.json();
    if(obj.errors) {
        Logging.InfoDev(obj.errors)
        throw new Error("Query failed: " + obj.errors);
    }

    return obj.data;
}

export async function fetchUserPlaces(walletProvider: ITezosWalletProvider, placeTypes: PlaceType | PlaceType[]) {
    if(!walletProvider.isWalletConnected()) return [];

    // TODO: hasura limits to 100 results.
    // Maybe need to keep fetching.

    try {
        const data = await grapphQLUser.getUserPlaces({ address: walletProvider.walletPHK(), placeTypes: placeTypes, offset: 0, amount: 100 });
        
        return data.placeTokenHolder;
    } catch(e: any) {
        Logging.InfoDev("failed to token holder: " + e.message);
        return []
    }
}