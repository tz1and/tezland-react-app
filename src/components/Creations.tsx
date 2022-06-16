import React from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Logging } from '../utils/Logging';
import { fetchGraphQL } from '../ipfs/graphql';
import { InventoryItem } from '../components/InventoryItem';
import { scrollbarVisible } from '../utils/Utils';
import { NavigateFunction, useNavigate } from 'react-router-dom';
import assert from 'assert';
import { getiFrameControl } from '../forms/DirectoryForm';

interface CreationsProps extends WithNavigateInterface {
    //selectItemFromInventory(id: number): void;
    //burnItemFromInventory(id: number): void;
    //transferItemFromInventory(id: number): void;
    //closeForm(cancelled: boolean): void;
    address: string;
    // using `interface` is also ok
    //message: string;
};

type CreationsState = {
    error?: string;
    //count: number; // like this
    //mount: HTMLDivElement | null;
    item_offset: number,
    more_data: boolean;
    hide_zero_balances: boolean;
};

class Creations extends React.Component<CreationsProps, CreationsState> {
    
    constructor(props: CreationsProps) {
        super(props);
        this.state = {
            item_offset: 0,
            more_data: true,
            hide_zero_balances: true
        };
    }

    private fetchAmount: number = 20;
    private firstFetchDone: boolean = false;

    private itemMap: Map<number, any> = new Map(); // TODO: map should belong to state?

    override componentDidMount() {
        this.fetchData();
    }

    override componentDidUpdate() {
        if(!scrollbarVisible(document.body)) {
            this.fetchMoreData();
        }
    }

    private async fetchInventory() {
        try {   
            const data = await fetchGraphQL(`
                query getCreations($address: String!, $offset: Int!, $amount: Int!) {
                    itemToken(where: {minterId: {_eq: $address}}, limit: $amount, offset: $offset, order_by: {id: desc}) {
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
                  }`, "getCreations", { address: this.props.address, amount: this.fetchAmount, offset: this.state.item_offset });
            
            return data.itemToken;
        } catch(e: any) {
            Logging.InfoDev("failed to fetch inventory: " + e.message);
            return []
        }
    }

    private fetchData = () => {
        this.fetchInventory().then((res) => {
            // first things first: set firstFetchDone
            this.firstFetchDone = true;

            for (const r of res) this.itemMap.set(r.id, r);
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

    handleClick = (item_id: number, quantity: number) => {
        assert(this.props.navigate);
        if(getiFrameControl(window))
            this.props.navigate(`/directory/i/${item_id}`);
        else
            this.props.navigate(`/i/${item_id}`);
    }

    handleBurn = (item_id: number) => {
        //this.props.burnItemFromInventory(item_id);
    }

    handleTransfer = (item_id: number) => {
        //this.props.transferItemFromInventory(item_id);
    }

    handleShowZeroBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.itemMap.clear();
        
        this.setState({
            hide_zero_balances: e.target.checked,
            item_offset: 0,
            more_data: true
        }, this.fetchData);
    }

    override render() {
        const { error, more_data } = this.state;

        const items: JSX.Element[] = []
        if (!error) this.itemMap.forEach(item => items.push(<InventoryItem key={item.id} onSelect={this.handleClick} item_metadata={{token: item}}/>))

        let content = error ? <h5 className='mt-3'>{error}</h5> : items;

        return (
            <InfiniteScroll
                className="d-flex flex-row flex-wrap justify-content-start align-items-start"
                dataLength={items.length} //This is important field to render the next data
                next={this.fetchMoreData}
                hasMore={more_data}
                loader={<h5 className='mt-3'>Loading...</h5>}
                scrollThreshold={0.9}
            >
                {content}
            </InfiniteScroll>
        );
    }
}

interface WithNavigateInterface {
    navigate?: NavigateFunction;
}

// inject useNavigate with a high order function component.
//https://github.com/remix-run/react-router/issues/8146#issuecomment-947860640
// TODO: move to a helpers module or something
function withNavigation <P>(Component: React.ComponentType<P>): React.FC<P> {
    return props => <Component {...props} navigate={useNavigate()} />;
};

const CreationsW = withNavigation(Creations);

export default CreationsW;
