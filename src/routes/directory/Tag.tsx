import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import assert from 'assert';
//import { useTezosWalletContext } from './TezosWalletContext';
import { InventoryItem } from '../../components/InventoryItem';
import { getiFrameControl } from '../../forms/DirectoryForm';
import { GraphQLInfiniteScroll } from '../../components/GraphQLInfiniteScroll';
import { grapphQLUser } from '../../graphql/user';

type TagProps = { };

export const Tag: React.FC<TagProps> = (props) => {
    //const walletContext = useTezosWalletContext();
    const params = useParams();
    const navigate = useNavigate();

    assert(params.tag);
    const tag = params.tag;

    const fetchInventory = async (dataOffset: number, fetchAmount: number) => {
        const data = await grapphQLUser.getItemsByTag({ tag: tag, offset: dataOffset, amount: fetchAmount });
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
        <main>
            <div className="position-relative container text-start mt-4">
                <h1>Items by tag '{tag}'</h1>
                <GraphQLInfiniteScroll fetchDataFunc={fetchInventory} handleClick={handleClick} fetchAmount={20} component={InventoryItem}/>
            </div>
        </main>
    );
}
