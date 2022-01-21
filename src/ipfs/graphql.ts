import Conf from "../Config";
import { Logging } from "../utils/Logging";

export async function fetchGraphQL(query: string, query_name: string, variables?: object) {
    const result = await fetch(
        Conf.hasura_url,
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