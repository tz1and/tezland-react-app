import React from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import TezosWalletContext from '../components/TezosWalletContext';
import { Logging } from '../utils/Logging';
import { InventoryItem } from '../components/InventoryItem';
import { scrollbarVisible } from '../utils/Utils';
import ItemTracker from '../controllers/ItemTracker';
import { FetchDataItemToken, FetchDataResult, ItemClickedFunc } from '../components/TokenInfiniteScroll';
import { grapphQLUser } from '../graphql/user';


type InventoryProps = {
    selectItemFromInventory(id: number, quantity: number): void;
    burnItemFromInventory(id: number, quantity: number): void;
    transferItemFromInventory(id: number, quantity: number): void;
    closeForm(): void;
    // using `interface` is also ok
    //message: string;
};

type InventoryState = {
    error?: string;
    //count: number; // like this
    //mount: HTMLDivElement | null;
    item_offset: number,
    more_data: boolean;
    firstFetchDone: boolean;
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
            firstFetchDone: false,
            counter: 0
        };
    }

    private static FetchAmount: number = 20;

    private trackedRemovals: FetchDataResult<FetchDataItemToken>[] = []; // TODO: array should belong to state!
    private itemMap: Map<number, FetchDataResult<FetchDataItemToken>> = new Map(); // TODO: map should belong to state!

    override componentDidMount() {
        this.fetchAvailableTempRemovals().then((res) => {
            this.trackedRemovals = res;
            this.setState({counter: this.state.counter + 1});
        });
        this.fetchData();
    }

    override componentDidUpdate() {
        const scrollTarget = document.getElementById("inventoryScrollTarget");
        if(scrollTarget && this.state.more_data && !scrollbarVisible(scrollTarget)) {
            this.fetchMoreData();
        }
    }

    private async fetchInventory(): Promise<FetchDataResult<FetchDataItemToken>[]> {
        try {
            const data = await grapphQLUser.getUserCollection({
                address: this.context.walletPHK(),
                amount: Inventory.FetchAmount, offset: this.state.item_offset });
            
            return data.itemTokenHolder;
        } catch(e: any) {
            Logging.InfoDev("failed to fetch inventory: " + e.message);
            return [];
        }
    }

    private async fetchAvailableTempRemovals(): Promise<FetchDataResult<FetchDataItemToken>[]> {
        // get tracked ids from ItemTokenTracker
        const trackedIds = ItemTracker.getTrackedTempItems();

        if (trackedIds.length === 0) return [];

        try {
            // Fetch tokens with a balance.
            const tokensWithBalance = await grapphQLUser.getInventoryTokensWithBalances({
                address: this.context.walletPHK(), ids: trackedIds });

            // Find all tracked tokens that don't have a balance.
            const tokensWithoutBalance: number[] = [];

            for (const tracked of trackedIds) {
                if (!tokensWithBalance.itemTokenHolder.find((e) => e.tokenId === tracked))
                    tokensWithoutBalance.push(tracked);
            }

            if(tokensWithoutBalance.length === 0) return [];

            // Fetch the metadata for those tokens
            const data = await grapphQLUser.getInventoryTokensWithoutBalance({ ids: tokensWithoutBalance });

            // trasnform it into the format we expect
            const result: FetchDataResult<FetchDataItemToken>[] = [];
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
            for (const r of res) this.itemMap.set(r.token.id, r);
            const more_data = res.length === Inventory.FetchAmount;
            this.setState({
                item_offset: this.state.item_offset + Inventory.FetchAmount,
                more_data: more_data,
                firstFetchDone: true
            });
        })
    }

    private fetchMoreData = () => {
        if(this.state.firstFetchDone && this.state.more_data) {
            this.fetchData();
        }
    }

    handleClick: ItemClickedFunc = (item_id: number, quantity?: number) => {
        this.props.selectItemFromInventory(item_id, quantity || 0);
    }

    handleBurn: ItemClickedFunc = (item_id: number, quantity?: number) => {
        this.props.burnItemFromInventory(item_id, quantity || 0);
    }

    handleTransfer: ItemClickedFunc = (item_id: number, quantity?: number) => {
        this.props.transferItemFromInventory(item_id, quantity || 0);
    }

    override render() {
        const { error, more_data } = this.state;

        const items: JSX.Element[] = []
        if (!error) {
            this.trackedRemovals.forEach(item => items.push(<InventoryItem key={item.token.id} onSelect={this.handleClick} item_metadata={item} trackItems={true} isTempItem={true} />))
            this.itemMap.forEach(item => items.push(<InventoryItem key={item.token.id} onSelect={this.handleClick} onBurn={this.handleBurn} onTransfer={this.handleTransfer} item_metadata={item} trackItems={true} />))
        }

        let content = error ? <h5 className='mt-3'>{error}</h5> : items;

        return (
            <div className='p-4 m-4 mx-auto bg-light bg-gradient border-0 rounded-3 text-dark position-relative' style={{width: "75vw"}}>
                <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => this.props.closeForm()}/>
                <h2>inventory</h2>
                Click to select an Item.
                <div id="inventoryScrollTarget" style={{height: '75vh', overflow: 'auto'}}>
                    <InfiniteScroll
                        className="d-flex flex-row flex-wrap justify-content-start align-items-start overflow-auto"
                        dataLength={items.length} //This is important field to render the next data
                        next={this.fetchMoreData}
                        hasMore={more_data}
                        loader={<h5 className='mt-3'>Loading...</h5>}
                        scrollThreshold={1.0}
                        scrollableTarget="inventoryScrollTarget"
                    >
                        {content}
                    </InfiniteScroll>
                </div>
            </div>
        );
    }
}
