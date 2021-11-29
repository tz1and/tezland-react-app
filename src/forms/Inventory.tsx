import React from 'react';
import renderToTexture from '../3D/RenderPreview'

type InventoryProps = {
    // using `interface` is also ok
    //message: string;
};

type InventoryState = {
    error?: Error;
    isLoaded: boolean;
    items: any[];
    imageBlob?: string;
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
        fetch(`${process.env.REACT_APP_BCD_URL}/v1/account/${process.env.REACT_APP_TEZOS_NETWORK}/${process.env.REACT_APP_DEV_ACCOUNT}/token_balances?contract=${process.env.REACT_APP_ITEM_CONTRACT}`)
            .then(res => res.json())
            .then(
                (result) => {
                    let blob = renderToTexture();

                    this.setState({
                        isLoaded: true,
                        items: result.balances,
                        imageBlob: blob
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
    }

    handleClick() {
        // todo make card into button somehow
        console.log('card clicked');
    }

    render() {
        const { error, isLoaded, items, imageBlob } = this.state;

        let content;
        if (error) {
            content = <div>Error: {error.message}</div>;
        } else if (!isLoaded) {
            content = <div>Loading...</div>;
        } else {
            content = items.map(item => (
                <div className="card m-2" style={{width: '200px', cursor: 'pointer'}} key={item.token_id} onClick={this.handleClick}>
                    <img src={imageBlob} className="card-img-top" width={200} height={200} alt="..."/>
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
                <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close"/>
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
