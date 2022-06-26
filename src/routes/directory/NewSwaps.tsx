import React from 'react';
//import { useTezosWalletContext } from './TezosWalletContext';
import { InventoryItem } from '../../components/InventoryItem';
import { useNavigate } from 'react-router-dom';
import { DirectoryUtils } from '../../utils/DirectoryUtils';
import { GraphQLInfiniteScroll } from '../../components/GraphQLInfiniteScroll';
import { grapphQLUser } from '../../graphql/user';

type NewSwapsProps = { };

export const NewSwaps: React.FC<NewSwapsProps> = (props) => {
    //const walletContext = useTezosWalletContext();
    const navigate = useNavigate();

    const fetchNewSwaps = async (dataOffset: number, fetchAmount: number) => {
        const res = await grapphQLUser.getNewSwaps({ amount: fetchAmount, offset: dataOffset });

        const results = res.worldItemPlacement;
        
        // format the data to fit the data format the item components expect.
        const formatted: any[] = []
        for (const res of results) {
            formatted.push({token: res.itemToken, swapInfo: { amount: res.tokenAmount, price: res.mutezPerToken }});
        }

        return formatted;
    }

    const handleClick = (item_id: number, quantity: number) => {
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
        <main>
            <div className="position-relative container text-start mt-4">
                <h1>New Swaps</h1>
                <GraphQLInfiniteScroll fetchDataFunc={fetchNewSwaps} handleClick={handleClick} fetchAmount={20} component={InventoryItem}/>
            </div>
        </main>
    );
}
