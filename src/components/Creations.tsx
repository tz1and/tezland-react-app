import React from 'react';
//import { useTezosWalletContext } from './TezosWalletContext';
import { InventoryItem } from '../components/InventoryItem';
import { useNavigate } from 'react-router-dom';
import { getiFrameControl } from '../forms/DirectoryForm';
import { GraphQLInfiniteScroll } from './GraphQLInfiniteScroll';
import { grapphQLUser } from '../graphql/user';

type CreationsProps = {
    //selectItemFromInventory(id: number): void;
    //burnItemFromInventory(id: number): void;
    //transferItemFromInventory(id: number): void;
    //closeForm(cancelled: boolean): void;
    address: string;
    // using `interface` is also ok
    //message: string;
};

export const Creations: React.FC<CreationsProps> = (props) => {
    //const walletContext = useTezosWalletContext();
    const navigate = useNavigate();

    const fetchInventory = async (dataOffset: number, fetchAmount: number) => {
        const data = await grapphQLUser.getUserCreations({ address: props.address, amount: fetchAmount, offset: dataOffset });
        const results = data.itemToken;

        // format the data to fit the data format the item components expect.
        const formatted: any[] = []
        for (const res of results) {
            formatted.push({token: res});
        }

        return formatted;
    }

    const handleClick = (item_id: number, quantity: number) => {
        if(getiFrameControl(window))
            navigate(`/directory/i/${item_id}`);
        else
            navigate(`/i/${item_id}`);
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
        <GraphQLInfiniteScroll fetchDataFunc={fetchInventory} handleClick={handleClick} fetchAmount={20} component={InventoryItem}/>
    );
}
