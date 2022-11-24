import React from 'react';
//import { useTezosWalletContext } from './TezosWalletContext';
import { InventoryItem } from '../../components/InventoryItem';
import { useNavigate } from 'react-router-dom';
import { DirectoryUtils } from '../../utils/DirectoryUtils';
import { FetchDataFunc, FetchDataResultArray, TokenInfiniteScroll, ItemClickedFunc } from '../../components/TokenInfiniteScroll';
import { grapphQLUser } from '../../graphql/user';
import TokenKey from '../../utils/TokenKey';


type NewMintsProps = { };

export const NewMints: React.FC<NewMintsProps> = (props) => {
    //const walletContext = useTezosWalletContext();
    const navigate = useNavigate();

    const fetchNewMints: FetchDataFunc = async (dataOffset: number, fetchAmount: number): Promise<FetchDataResultArray> => {
        const res = await grapphQLUser.getNewMints({ amount: fetchAmount, offset: dataOffset });

        const results = res.itemToken;
        
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
                <h1>New Mints</h1>
                <TokenInfiniteScroll fetchDataFunc={fetchNewMints} handleClick={handleClick} fetchAmount={20} component={InventoryItem}/>
            </div>
        </main>
    );
}
