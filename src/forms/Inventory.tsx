import React from 'react';
import './Inventory.css';
import Conf from '../Config'
import InfiniteScroll from 'react-infinite-scroll-component';
import TezosWalletContext from '../components/TezosWalletContext';
import { Logging } from '../utils/Logging';
import { fetchGraphQL } from '../ipfs/graphql';
import { truncate } from '../utils/Utils';

type InventoryProps = {
    selectItemFromInventory(id: number): void;
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
};

export class Inventory extends React.Component<InventoryProps, InventoryState> {
    static contextType = TezosWalletContext;
    context!: React.ContextType<typeof TezosWalletContext>;
    
    constructor(props: InventoryProps) {
        super(props);
        this.state = {
            item_offset: 0,
            more_data: true
        };
    }

    private fetchAmount: number = 20;
    private firstFetchDone: boolean = false;

    private itemMap: Map<number, any> = new Map();

    componentDidMount() {
        this.fetchInventory().then((res) => {
            for (const r of res) this.itemMap.set(r.token.id, r);
            const more_data = res.length === this.fetchAmount;
            this.setState({
                item_offset: this.fetchAmount,
                more_data: more_data
            });
            this.firstFetchDone = true;
        })
    }

    private async fetchInventory() {
        try {   
            const data = await fetchGraphQL(`
                query getInventory($address: String!, $offset: Int!, $amount: Int!) {
                    itemTokenHolder(where: {holderId: {_eq: $address}}, limit: $amount, offset: $offset, order_by: {tokenId: desc}) {
                      quantity
                      token {
                        id
                        description
                        artifactUri
                        metadataFetched
                        mimeType
                        royalties
                        supply
                        thumbnailUri
                        name
                        minterId
                      }
                    }
                  }`, "getInventory", { address: this.context.walletPHK(), amount: this.fetchAmount, offset: this.state.item_offset });
            
            return data.itemTokenHolder;
        } catch(e: any) {
            Logging.InfoDev("failed to fetch inventory: " + e.message);
            return []
        }
    }

    private fetchMoreData = () => {
        if(this.firstFetchDone) {
            this.fetchInventory().then((res) => {
                for (const r of res) this.itemMap.set(r.token.id, r);
                const more_data = res.length === this.fetchAmount;
                this.setState({
                    item_offset: this.state.item_offset + this.fetchAmount,
                    more_data: more_data
                });
            })
        }
    }

    handleClick = (event: React.MouseEvent) => {
        this.props.selectItemFromInventory(Number.parseInt(event.currentTarget.id));
    }

    private getThumbnailUrl(url: string | undefined): string {
        if(url) return `${Conf.ipfs_gateway}/ipfs/${url.slice(7)}`;

        return "/img/missing_thumbnail.png";
    }

    render() {
        const { error, more_data } = this.state;

        const items: JSX.Element[] = []
         if (!error) this.itemMap.forEach(item => items.push(
            <div className="card m-2 inventory-item" key={item.token.id} id={item.token.id} onClick={this.handleClick}>
                <img src={this.getThumbnailUrl(item.token.thumbnailUri)} className="card-img-top" alt="..."/>
                <div className="card-body">
                <h5 className="card-title">{item.token.name !== "" ? truncate(item.token.name, 15, '\u2026') : <span className='text-danger'>Metadata missing</span>}</h5>
                <p className="card-text">x{item.quantity}</p>
                <p className="card-text small m-0">Minter: </p>
                <p className="card-text small text-muted">{truncate(item.token.minterId, 16, '\u2026')}</p>
                </div>
            </div>
        ))

        let content = error ? <h5 className='mt-3'>{error}</h5> : items;

        return (
            <div className='p-4 m-4 mx-auto bg-light bg-gradient border-0 rounded-3 text-dark position-relative' style={{width: "75vw"}}>
                <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => this.props.closeForm(true)}/>
                <h2>inventory</h2>
                Click to select an Item.
                <InfiniteScroll
                    className="d-flex flex-row flex-wrap justify-content-start align-items-start overflow-auto"
                    style={{height: '75vh'}}
                    height='75vh'
                    dataLength={items.length} //This is important field to render the next data
                    next={this.fetchMoreData}
                    hasMore={more_data}
                    loader={<h5 className='mt-3'>Loading...</h5>}
                    scrollThreshold={0.9}
                >
                    {content}
                </InfiniteScroll>
            </div>
        );
    }
}
