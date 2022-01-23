import React from 'react';
import './Inventory.css';
import Conf from '../Config'
import InfiniteScroll from 'react-infinite-scroll-component';
import TezosWalletContext from '../components/TezosWalletContext';

type InventoryProps = {
    selectItemFromInventory(id: number): void;
    closeForm(cancelled: boolean): void;
    // using `interface` is also ok
    //message: string;
};

type InventoryState = {
    error?: string;
    items: any[];
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
            items: [],
            item_offset: 0,
            more_data: true
        };
    }

    private fetchAmount: number = 25;
    private firstFetchDone: boolean = false;

    componentDidMount() {
        this.loadInventory((res) => {
            const more_data = res.balances.length === this.fetchAmount;
            this.setState({
                items: res.balances,
                item_offset: this.fetchAmount,
                more_data: more_data
            });
            this.firstFetchDone = true;
        })
    }

    private loadInventory(callback: (res: any) => void) {
        if(!this.context.isWalletConnected()) {
            this.setState({
                error: "No wallet connected.",
                more_data: false
            });
            return;
        }

        fetch(`${Conf.bcd_url}/v1/account/${Conf.tezos_network}/${this.context.walletPHK()}/token_balances?contract=${Conf.item_contract}&size=${this.fetchAmount}&offset=${this.state.item_offset}`)
        .then(res => res.json())
        .then(callback,
            (error) => {
                this.setState({
                    error: error.message,
                    more_data: false
                });
            }
        );
    }

    private fetchMoreData = () => {
        if(this.firstFetchDone) {
            this.loadInventory((res) => {
                const more_data = res.balances.length === this.fetchAmount;
                this.setState({
                    items: this.state.items.concat(res.balances),
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
        if(url) return "http://localhost:8080/ipfs/" + url.slice(7);

        return "/img/missing_thumbnail.png";
    }

    render() {
        const { error, items, more_data } = this.state;

        let content = error ? <h5 className='mt-3'>{error}</h5> : items.map(item => (
            <div className="card m-2 inventory-item" key={item.token_id} id={item.token_id} onClick={this.handleClick}>
                <img src={this.getThumbnailUrl(item.thumbnail_uri)} className="card-img-top" alt="..."/>
                <div className="card-body">
                <h5 className="card-title">{item.name}</h5>
                <p className="card-text">x{item.balance}</p>
                <p className="card-text"><small className="text-muted">Creator or so maybe</small></p>
                </div>
            </div>
        ))

        return (
            <div className='p-4 m-4 mx-auto bg-light border-0 rounded-3 text-dark position-relative' style={{width: "75vw"}}>
                <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => this.props.closeForm(true)}/>
                <h2>inventory</h2>
                <InfiniteScroll
                    className="d-flex flex-row flex-wrap justify-content-start align-items-start overflow-auto"
                    style={{height: '75vh'}}
                    height='75vh'
                    dataLength={items.length} //This is important field to render the next data
                    next={this.fetchMoreData}
                    hasMore={more_data}
                    loader={<h5 className='mt-3'>Loading...</h5>}
                    scrollThreshold={0.8}
                >
                    {content}
                </InfiniteScroll>
            </div>
        );
    }
}
