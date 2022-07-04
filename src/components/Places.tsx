import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlaceItem } from './PlaceItem';
//import { useTezosWalletContext } from './TezosWalletContext';
import { FetchDataFunc, FetchDataResultArray, TokenInfiniteScroll, ItemClickedFunc } from './TokenInfiniteScroll';
import { grapphQLUser } from '../graphql/user';
import { DirectoryUtils } from '../utils/DirectoryUtils';

type PlacesProps = {
    //selectItemFromInventory(id: number): void;
    //burnItemFromInventory(id: number): void;
    //transferItemFromInventory(id: number): void;
    address: string;
    // using `interface` is also ok
    //message: string;
};

export const Places: React.FC<PlacesProps> = (props) => {
    //const walletContext = useTezosWalletContext();
    const navigate = useNavigate();

    const fetchInventory: FetchDataFunc = async (dataOffset: number, fetchAmount: number): Promise<FetchDataResultArray> => {
        const res = await grapphQLUser.getUserPlaces({ address: props.address, amount: fetchAmount, offset: dataOffset });
        
        return res.placeTokenHolder;
    }

    const handleClick: ItemClickedFunc = (item_id: number, quantity?: number) => {
        navigate(DirectoryUtils.placeLink(item_id));
    }

    /*const handleTransfer = (item_id: number) => {
        //this.props.transferItemFromInventory(item_id);
    }*/

    //const isOwned = walletContext.isWalletConnected() && walletContext.walletPHK() === props.address;

    return (
        <TokenInfiniteScroll fetchDataFunc={fetchInventory} handleClick={handleClick} fetchAmount={20} component={PlaceItem}/>
    );
}
