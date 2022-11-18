import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import assert from 'assert';
//import { useTezosWalletContext } from './TezosWalletContext';
import { InventoryItem } from '../../components/InventoryItem';
import { FetchDataFunc, FetchDataResultArray, TokenInfiniteScroll, ItemClickedFunc } from '../../components/TokenInfiniteScroll';
import { grapphQLUser } from '../../graphql/user';
import { DirectoryUtils } from '../../utils/DirectoryUtils';
import { Helmet } from 'react-helmet-async';
import TokenKey from '../../utils/TokenKey';


type TagProps = { };

export const Tag: React.FC<TagProps> = (props) => {
    //const walletContext = useTezosWalletContext();
    const params = useParams();
    const navigate = useNavigate();

    assert(params.tag);
    const tag = params.tag;

    const fetchInventory: FetchDataFunc = async (dataOffset: number, fetchAmount: number): Promise<FetchDataResultArray> => {
        const data = await grapphQLUser.getItemsByTag({ tag: tag, offset: dataOffset, amount: fetchAmount });
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
            <Helmet>
                <title>tz1and - Tag "{tag}"</title>
            </Helmet>
            <div className="position-relative container text-start mt-4">
                <h1>Items by tag '{tag}'</h1>
                <TokenInfiniteScroll fetchDataFunc={fetchInventory} handleClick={handleClick} fetchAmount={20} component={InventoryItem}/>
            </div>
        </main>
    );
}
