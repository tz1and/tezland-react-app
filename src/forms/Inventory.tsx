import React from 'react';
import './Inventory.css';
import Contracts from '../tz/Contracts'
import Conf from '../Config'

type InventoryProps = {
    selectItemFromInventory(id: number): void;
    closeForm(cancelled: boolean): void;
    // using `interface` is also ok
    //message: string;
};

type InventoryState = {
    error?: Error;
    isLoaded: boolean;
    items: any[];
    //count: number; // like this
    //mount: HTMLDivElement | null;
};

export class Inventory extends React.Component<InventoryProps, InventoryState> {
    constructor(props: InventoryProps) {
        super(props);
        this.state = {
            isLoaded: false,
            items: []
        };
    }

    componentDidMount() {
        Contracts.walletPHK().then(wallet_address => {
            fetch(`${Conf.bcd_url}/v1/account/${Conf.tezos_network}/${wallet_address}/token_balances?contract=${Conf.item_contract}`)
                .then(res => res.json())
                .then(
                    (result) => {
                        this.setState({
                            isLoaded: true,
                            items: result.balances
                        });
                    },
                    // Note: it's important to handle errors here
                    // instead of a catch() block so that we don't swallow
                    // exceptions from actual bugs in components.
                    (error) => {
                        this.setState({
                            isLoaded: true,
                            error: error
                        });
                    }
                )
            }, error => {
                this.setState({
                    isLoaded: true,
                    error: new Error("No wallet connected")
                });
            });
    }

    handleClick(event: React.MouseEvent) {
        this.props.selectItemFromInventory(Number.parseInt(event.currentTarget.id));
    }

    private getThumbnailUrl(url: string | undefined): string {
        if(url) return "http://localhost:8080/ipfs/" + url.slice(7);

        return "/img/missing_thumbnail.png";
    }

    render() {
        const { error, isLoaded, items } = this.state;

        let content;
        if (error) {
            content = <div>Error: {error.message}</div>;
        } else if (!isLoaded) {
            content = <div>Loading...</div>;
        } else {
            content = items.map(item => (
                <div className="card m-2 inventory-item" key={item.token_id} id={item.token_id} onClick={this.handleClick.bind(this)}>
                    <img src={this.getThumbnailUrl(item.thumbnail_uri)} className="card-img-top" alt="..."/>
                    <div className="card-body">
                    <h5 className="card-title">{item.name}</h5>
                    <p className="card-text">x{item.balance}</p>
                    <p className="card-text"><small className="text-muted">Creator or so maybe</small></p>
                    </div>
                </div>
            ))
                
        }

        return (
            <div className='p-4 bg-light border-0 rounded-3 text-dark position-relative w-75'>
                <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => this.props.closeForm(true)}/>
                <h2>inventory</h2>
                <div className="d-flex flex-row flex-wrap justify-content-start align-items-start overflow-auto" style={{height: '75vh'}}>
                    {content}
                    
                </div>
            </div>
        );

        /*<div className="card m-2" style={{width: '200px'}}>
            <img src={imageBlob} className="card-img-top" width={200} height={200} alt="..."/>
            <div className="card-body">
            <h5 className="card-title">Card title</h5>
            <p className="card-text">This is a wider</p>
            <p className="card-text"><small className="text-muted">Last updated 3 mins ago</small></p>
            </div>
        </div>*/
    }
}
