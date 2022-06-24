import React from 'react';
import { fetchGraphQL } from '../ipfs/graphql';
import { PlaceItem } from './PlaceItem';
//import { useTezosWalletContext } from './TezosWalletContext';
import { GraphQLInfiniteScroll } from './GraphQLInfiniteScroll';

type PlacesProps = {
    //selectItemFromInventory(id: number): void;
    //burnItemFromInventory(id: number): void;
    //transferItemFromInventory(id: number): void;
    //closeForm(cancelled: boolean): void;
    address: string;
    // using `interface` is also ok
    //message: string;
};

export const Places: React.FC<PlacesProps> = (props) => {
    //const walletContext = useTezosWalletContext();

    const fetchInventory = async (dataOffset: number, fetchAmount: number) => {
        const data = await fetchGraphQL(`
            query getPlaces($address: String!, $offset: Int!, $amount: Int!) {
                placeTokenHolder(where: {holderId: {_eq: $address}}, limit: $amount, offset: $offset, order_by: {tokenId: desc}) {
                    token {
                        id
                    }
                }
                }`, "getPlaces", { address: props.address, amount: fetchAmount, offset: dataOffset });
        
        return data.placeTokenHolder;
    }

    const handleClick = (item_id: number) => {
        //this.props.selectItemFromInventory(item_id);
    }

    /*const handleTransfer = (item_id: number) => {
        //this.props.transferItemFromInventory(item_id);
    }*/

    //const isOwned = walletContext.isWalletConnected() && walletContext.walletPHK() === props.address;

    return (
        <GraphQLInfiniteScroll fetchDataFunc={fetchInventory} handleClick={handleClick} fetchAmount={20} component={PlaceItem}/>
    );
}
