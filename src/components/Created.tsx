import React from 'react';
//import { useTezosWalletContext } from './TezosWalletContext';
import { InventoryItem } from './InventoryItem';
import { useNavigate } from 'react-router-dom';
import { FetchDataFunc, FetchDataResultArray, TokenInfiniteScroll, ItemClickedFunc } from './TokenInfiniteScroll';
import { grapphQLUser } from '../graphql/user';
import { DirectoryUtils } from '../utils/DirectoryUtils';
import TokenKey from '../utils/TokenKey';


type CreationsProps = {
    //selectItemFromInventory(id: number): void;
    //burnItemFromInventory(id: number): void;
    //transferItemFromInventory(id: number): void;
    address: string;
    // using `interface` is also ok
    //message: string;
};

export const Created: React.FC<CreationsProps> = (props) => {
    //const walletContext = useTezosWalletContext();
    const navigate = useNavigate();

    const fetchInventory: FetchDataFunc = async (dataOffset: number, fetchAmount: number): Promise<FetchDataResultArray> => {
        const data = await grapphQLUser.getUserCreations({ address: props.address, amount: fetchAmount, offset: dataOffset });
        const results = data.itemToken;

        // format the data to fit the data format the item components expect.
        const formatted: FetchDataResultArray = []
        for (const res of results) {
            formatted.push({token: res});
        }

        return formatted;
    }

    const handleClick: ItemClickedFunc = (token_key: TokenKey, quantity?: number) => {
        // TODO: should link to fa2/tokenid
        navigate(DirectoryUtils.itemLink(token_key));
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
