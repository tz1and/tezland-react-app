import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlaceItem } from './PlaceItem';
//import { useTezosWalletContext } from './TezosWalletContext';
import { FetchDataFunc, FetchDataResultArray, TokenInfiniteScroll, ItemClickedFunc } from './TokenInfiniteScroll';
import { grapphQLUser } from '../graphql/user';
import { DirectoryUtils } from '../utils/DirectoryUtils';
import Conf from '../Config';
import TokenKey from '../utils/TokenKey';
import PlaceKey from '../utils/PlaceKey';


// TODO: should be using PlaceKey

type PlacesProps = {
    //selectItemFromInventory(id: number, quantity: number): void;
    //burnItemFromInventory(id: number, quantity: number): void;
    //transferItemFromInventory(id: number, quantity: number): void;
    address: string;
    // using `interface` is also ok
    //message: string;
};

export const Places: React.FC<PlacesProps> = (props) => {
    //const walletContext = useTezosWalletContext();
    const navigate = useNavigate();

    const fetchInventory: FetchDataFunc = async (dataOffset: number, fetchAmount: number): Promise<FetchDataResultArray> => {
        const res = await grapphQLUser.getUserPlaces({ address: props.address, contracts: [Conf.place_contract, Conf.interior_contract], amount: fetchAmount, offset: dataOffset });
        
        return res.placeTokenHolder;
    }

    const handleClick: ItemClickedFunc = (token_key: TokenKey, quantity?: number) => {
        // TODO: should link to fa2/tokenid
        navigate(DirectoryUtils.placeLink(new PlaceKey(token_key.id.toNumber(), token_key.fa2)));
    }

    /*const handleTransfer = (item_id: number, quantity: number) => {
        //this.props.transferItemFromInventory(item_id, quantity);
    }*/

    //const isOwned = walletContext.isWalletConnected() && walletContext.walletPHK() === props.address;

    return (
        <TokenInfiniteScroll fetchDataFunc={fetchInventory} handleClick={handleClick} fetchAmount={20} component={PlaceItem}/>
    );
}
