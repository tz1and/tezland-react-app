import React from 'react';
//import { useTezosWalletContext } from './TezosWalletContext';
import { InventoryItem } from '../../components/InventoryItem';
import { useNavigate } from 'react-router-dom';
import { DirectoryUtils } from '../../utils/DirectoryUtils';
import { FetchDataFunc, FetchDataResultArray, TokenInfiniteScroll, ItemClickedFunc } from '../../components/TokenInfiniteScroll';
import { grapphQLUser } from '../../graphql/user';
import TokenKey from '../../utils/TokenKey';


type NewSwapsProps = { };

export const NewSwaps: React.FC<NewSwapsProps> = (props) => {
    //const walletContext = useTezosWalletContext();
    const navigate = useNavigate();

    const fetchNewSwaps: FetchDataFunc = async (dataOffset: number, fetchAmount: number): Promise<FetchDataResultArray> => {
        const res = await grapphQLUser.getNewSwaps({ amount: fetchAmount, offset: dataOffset });

        const results = res.worldItemPlacement;
        
        // format the data to fit the data format the item components expect.
        const formatted: FetchDataResultArray = []
        for (const res of results) {
            formatted.push({key: res.transientId, token: res.itemToken, swapInfo: { amount: res.tokenAmount, price: res.mutezPerToken }});
        }

        return formatted;
    }

    const handleClick: ItemClickedFunc = (token_key: TokenKey, quantity?: number) => {
        // TODO: should link to fa2/tokenid
        navigate(DirectoryUtils.itemLink(token_key.id.toNumber()));
    }

    /*const handleBurn: ItemClickedFunc = (item_id: number, quantity?: number) => {
        // TODO: modal version of transfer dialog
        //this.props.burnItemFromInventory(item_id, quantity);
    }

    const handleTransfer: ItemClickedFunc = (item_id: number, quantity?: number) => {
        // TODO: modal version of burn dialog
        //this.props.transferItemFromInventory(item_id, quantity);
    }*/

    return (
        <main>
            <div className="position-relative container text-start mt-4">
                <h1>New Swaps</h1>
                <TokenInfiniteScroll fetchDataFunc={fetchNewSwaps} handleClick={handleClick} fetchAmount={20} component={InventoryItem}/>
            </div>
        </main>
    );
}
