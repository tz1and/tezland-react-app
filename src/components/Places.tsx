import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlaceItem } from './PlaceItem';
//import { useTezosWalletContext } from './TezosWalletContext';
import { GraphQLInfiniteScroll } from './GraphQLInfiniteScroll';
import { grapphQLUser } from '../graphql/user';
import { getiFrameControl } from '../forms/DirectoryForm';

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
    const navigate = useNavigate();

    const fetchInventory = async (dataOffset: number, fetchAmount: number) => {
        const res = await grapphQLUser.getUserPlaces({ address: props.address, amount: fetchAmount, offset: dataOffset });
        
        return res.placeTokenHolder;
    }

    const handleClick = (item_id: number, quantity: number) => {
        if(getiFrameControl(window))
            navigate(`/directory/p/${item_id}`);
        else
            navigate(`/p/${item_id}`);
    }

    /*const handleTransfer = (item_id: number) => {
        //this.props.transferItemFromInventory(item_id);
    }*/

    //const isOwned = walletContext.isWalletConnected() && walletContext.walletPHK() === props.address;

    return (
        <GraphQLInfiniteScroll fetchDataFunc={fetchInventory} handleClick={handleClick} fetchAmount={20} component={PlaceItem}/>
    );
}
