import React, { useCallback, useEffect, useState } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { scrollbarVisible } from '../utils/Utils';

type FetchDataItemMetadata = {
    name: string;
    description: string;
    artifactUri: string;
    displayUri?: string | null;
    thumbnailUri?: string | null;
    baseScale: number;
    fileSize: number;
    mimeType: string;
    polygonCount: number;
    timestamp: string;
};

export type FetchDataItemToken = {
    id: number;
    metadata?: FetchDataItemMetadata | null;
    royalties: number;
    supply: number;
    minterId: string;
}

type FetchDataSwapInfo = {
    amount: number;
    price: number;
}

export type FetchDataPlaceToken = {
    id: number;
}

export type FetchDataResult<T> = {
    //key?: string | number;
    token: T;
    quantity?: number;
    swapInfo?: FetchDataSwapInfo;
}

export type FetchDataResultArray = FetchDataResult<FetchDataItemToken | FetchDataPlaceToken>[];

export type FetchDataFunc = (dataOffset: number, fetchAmount: number) => Promise<FetchDataResultArray>;
export type ItemClickedFunc = (item_id: number, quantity?: number) => void;

type GraphQLInfiniteScrollProps = {
    fetchDataFunc: FetchDataFunc;
    handleClick?: ItemClickedFunc;
    fetchAmount: number;
    component: React.ElementType;
};

type GraphQLInfiniteScrollState = {
    itemMap: Map<number, FetchDataResult<FetchDataItemToken | FetchDataPlaceToken> >;
    moreData: boolean;
    itemOffset: number;
}


export const GraphQLInfiniteScroll: React.FC<GraphQLInfiniteScrollProps> = (props) => {

    const [state, setState] = useState<GraphQLInfiniteScrollState>({
        itemMap: new Map(),
        moreData: false,
        itemOffset: 0
    });

    const [firstFetchDone, setFirstFetchDone] = useState<boolean>(false);
    const [error, setError] = useState<string>();

    const fetchData = useCallback(() => {
        props.fetchDataFunc(state.itemOffset, props.fetchAmount).then((res) => {
            for (const r of res) state.itemMap.set(r.token.id, r);
            const more_data = res.length === props.fetchAmount;

            setState({
                itemOffset: state.itemOffset + props.fetchAmount,
                moreData: more_data,
                itemMap: state.itemMap
            });
        }).catch(e => {
            setError("Failed to fetch data" + e);
        });
    }, [props, state]);

    const fetchMoreData = () => {
        if(!error && firstFetchDone && state.moreData) {
            fetchData();
        }
    }

    /*const handleBurn = (item_id: number) => {
        // TODO: modal version of transfer dialog
        //this.props.burnItemFromInventory(item_id);
    }

    const handleTransfer = (item_id: number) => {
        // TODO: modal version of burn dialog
        //this.props.transferItemFromInventory(item_id);
    }*/

    useEffect(() => {
        if(!firstFetchDone) {
            fetchData();
            setFirstFetchDone(true);
        }
        else if(state.moreData && !scrollbarVisible(document.body)) {
            fetchData();
        }
    }, [firstFetchDone, fetchData, state.moreData]);

    const items: JSX.Element[] = []
    if (!error) state.itemMap.forEach(item => items.push(<props.component key={item.token.id} onSelect={props.handleClick}
        /*onBurn={isOwned ? this.handleBurn : undefined}
        onTransfer={isOwned ? this.handleTransfer : undefined}*/
        item_metadata={item}/>))

    let content = error ? <h5 className='mt-3'>{error}</h5> : items;

    return (
        <InfiniteScroll
            className="d-flex flex-row flex-wrap justify-content-start align-items-start"
            dataLength={items.length} //This is important field to render the next data
            next={fetchMoreData}
            hasMore={state.moreData}
            loader={<h5 className='mt-3'>Loading...</h5>}
            scrollThreshold={0.9}
        >
            {content}
        </InfiniteScroll>
    );
}
