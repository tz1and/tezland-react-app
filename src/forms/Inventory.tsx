import React from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import TezosWalletContext from '../components/TezosWalletContext';
import { Logging } from '../utils/Logging';
import { fetchGraphQL } from '../ipfs/graphql';
import { InventoryItem } from '../components/InventoryItem';
import { scrollbarVisible } from '../utils/Utils';
import ItemTracker from '../controllers/ItemTracker';
import { ItemClickedFunc } from '../components/TokenInfiniteScroll';


type InventoryProps = {
    selectItemFromInventory(id: number, quantity: number): void;
    burnItemFromInventory(id: number): void;
    transferItemFromInventory(id: number): void;
    closeForm(cancelled: boolean): void;
    // using `interface` is also ok
    //message: string;
};

type InventoryState = {
    error?: string;
    //count: number; // like this
    //mount: HTMLDivElement | null;
    item_offset: number,
    more_data: boolean;
    counter: number;
};

// TODO: could we use TokenInfiniteScroll here?
export class Inventory extends React.Component<InventoryProps, InventoryState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;
    
    constructor(props: InventoryProps) {
        super(props);
        this.state = {
            item_offset: 0,
            more_data: true,
            counter: 0
        };
    }

    private fetchAmount: number = 20;
    private firstFetchDone: boolean = false;

    private trackedRemovals: any[] = []; // TODO: array should belong to state?
    private itemMap: Map<number, any> = new Map(); // TODO: map should belong to state?

    override componentDidMount() {
        this.fetchAvailableTempRemovals().then((res) => {
            this.trackedRemovals = res;
            this.setState({counter: this.state.counter + 1});
        });
        this.fetchData();
    }

    override componentDidUpdate() {
        const scrollTarget = document.getElementById("inventoryScrollTarget");
        if(scrollTarget && !scrollbarVisible(scrollTarget)) {
            this.fetchMoreData();
        }
    }

    private async fetchInventory() {
        try {   
            const data = await fetchGraphQL(`
                query getInventory($address: String!, $offset: Int!, $amount: Int!) {
                    itemTokenHolder(where: {holderId: {_eq: $address}}, limit: $amount, offset: $offset, order_by: {tokenId: desc}) {
                        quantity
                        token {
                            id
                            metadata {
                                name
                                description
                                artifactUri
                                displayUri
                                thumbnailUri
                                baseScale
                                fileSize
                                mimeType
                                polygonCount
                                timestamp
                            }
                            royalties
                            supply
                            minterId
                        }
                    }
                  }`, "getInventory", { address: this.context.walletPHK(), amount: this.fetchAmount, offset: this.state.item_offset });
            
            return data.itemTokenHolder;
        } catch(e: any) {
            Logging.InfoDev("failed to fetch inventory: " + e.message);
            return [];
        }
    }

    private async fetchAvailableTempRemovals() {
        // get tracked ids from ItemTokenTracker
        const trackedIds = ItemTracker.getTrackedTempItems();

        if (trackedIds.length === 0) return [];

        try {
            // Fetch tokens with a balance.
            const tokensWithBalance = await fetchGraphQL(`
                query getTokensWithBalances($address: String!, $ids: [bigint!]) {
                    itemTokenHolder(where: {tokenId: {_in: $ids}, holderId: {_eq: $address}}) {
                        tokenId
                    }
                }`, "getTokensWithBalances", { address: this.context.walletPHK(), ids: trackedIds });

            // Find all tracked tokens that don't have a balance.
            const tokensWithoutBalance: number[] = [];

            for (const tracked of trackedIds) {
                if (!tokensWithBalance.itemTokenHolder.find((e: any) => e.tokenId === tracked))
                    tokensWithoutBalance.push(tracked);
            }

            if(tokensWithoutBalance.length === 0) return [];

            // Fetch the metadata for those tokens
            const data = await fetchGraphQL(`
                query getTokensWithoutBalance($ids: [bigint!]) {
                    itemToken(where: {id: {_in: $ids}}) {
                        id
                        metadata {
                            name
                            description
                            artifactUri
                            displayUri
                            thumbnailUri
                            baseScale
                            fileSize
                            mimeType
                            polygonCount
                            timestamp
                        }
                        royalties
                        supply
                        minterId
                    }
                  }`, "getTokensWithoutBalance", { ids: tokensWithoutBalance });

            // trasnform it into the format we expect
            const result: any[] = [];
            for (const item of data.itemToken) {
                result.push({ quantity: 0, token: item })
            }
            
            return result;
        } catch(e: any) {
            Logging.InfoDev("failed to fetch tokens without balance: " + e.message);
            return [];
        }
    }

    private fetchData = () => {
        this.fetchInventory().then((res) => {
            // first things first: set firstFetchDone
            this.firstFetchDone = true;

            for (const r of res) this.itemMap.set(r.token.id, r);
            const more_data = res.length === this.fetchAmount;
            this.setState({
                item_offset: this.state.item_offset + this.fetchAmount,
                more_data: more_data
            });
        })
    }

    private fetchMoreData = () => {
        if(this.firstFetchDone && this.state.more_data) {
            this.fetchData();
        }
    }

    handleClick: ItemClickedFunc = (item_id: number, quantity?: number) => {
        this.props.selectItemFromInventory(item_id, quantity || 0);
    }

    handleBurn = (item_id: number) => {
        this.props.burnItemFromInventory(item_id);
    }

    handleTransfer = (item_id: number) => {
        this.props.transferItemFromInventory(item_id);
    }

    override render() {
        const { error, more_data } = this.state;

        const items: JSX.Element[] = []
        if (!error) {
            this.trackedRemovals.forEach(item => items.push(<InventoryItem key={item.token.id} onSelect={this.handleClick} onBurn={this.handleBurn} onTransfer={this.handleTransfer} item_metadata={item} trackItems={true} isTempItem={true} />))
            this.itemMap.forEach(item => items.push(<InventoryItem key={item.token.id} onSelect={this.handleClick} onBurn={this.handleBurn} onTransfer={this.handleTransfer} item_metadata={item} trackItems={true} />))
        }

        let content = error ? <h5 className='mt-3'>{error}</h5> : items;

        return (
            <div className='p-4 m-4 mx-auto bg-light bg-gradient border-0 rounded-3 text-dark position-relative' style={{width: "75vw"}}>
                <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => this.props.closeForm(true)}/>
                <h2>inventory</h2>
                Click to select an Item.
                <div id="inventoryScrollTarget" style={{height: '75vh', overflow: 'auto'}}>
                    <InfiniteScroll
                        className="d-flex flex-row flex-wrap justify-content-start align-items-start overflow-auto"
                        dataLength={items.length} //This is important field to render the next data
                        next={this.fetchMoreData}
                        hasMore={more_data}
                        loader={<h5 className='mt-3'>Loading...</h5>}
                        scrollThreshold={0.9}
                        scrollableTarget="inventoryScrollTarget"
                    >
                        {content}
                    </InfiniteScroll>
                </div>
            </div>
        );
    }
}
