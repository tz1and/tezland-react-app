import React from 'react';
//import { useTezosWalletContext } from './TezosWalletContext';
import { InventoryItem } from '../components/InventoryItem';
import { useNavigate } from 'react-router-dom';
import { DirectoryUtils } from '../utils/DirectoryUtils';
import { FetchDataFunc, FetchDataResultArray, TokenInfiniteScroll, ItemClickedFunc } from './TokenInfiniteScroll';
import { grapphQLUser } from '../graphql/user';

type CollectionProps = {
    //selectItemFromInventory(id: number): void;
    //burnItemFromInventory(id: number): void;
    //transferItemFromInventory(id: number): void;
    //closeForm(cancelled: boolean): void;
    address: string;
    // using `interface` is also ok
    //message: string;
};

export const Collection: React.FC<CollectionProps> = (props) => {
    //const walletContext = useTezosWalletContext();
    const navigate = useNavigate();

    const fetchInventory: FetchDataFunc = async (dataOffset: number, fetchAmount: number): Promise<FetchDataResultArray> => {
        const res = await grapphQLUser.getUserCollection({ address: props.address, amount: fetchAmount, offset: dataOffset });
        
        return res.itemTokenHolder;
    }

    const handleClick: ItemClickedFunc = (item_id: number, quantity?: number) => {
        navigate(DirectoryUtils.itemLink(item_id));
    }

    /*const handleBurn = (item_id: number) => {
        // TODO: modal version of transfer dialog
        //this.props.burnItemFromInventory(item_id);
    }

    const handleTransfer = (item_id: number) => {
        // TODO: modal version of burn dialog
        //this.props.transferItemFromInventory(item_id);
    }*/

    return (
        <TokenInfiniteScroll fetchDataFunc={fetchInventory} handleClick={handleClick} fetchAmount={20} component={InventoryItem}/>
    );
}
