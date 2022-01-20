import Conf from "../Config";

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
    return await result.json()
}