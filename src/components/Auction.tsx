import './Auction.css'

type AuctionProps = {
    auctionId: number;
    startPrice: number;
    endPrice: number;
    // using `interface` is also ok
    //message: string;
  };

export default function Auction(props: AuctionProps) {
    return (
        <div className="m-3 Auction">
            <img className="mx-auto mb-1 d-block" src="/logo192.png" alt="" width="48" height="48" />
            <p className="text-center">Auction place #{props.auctionId}</p>
            <p>Start time / End time
                <div className="progress">
                    <div id="auctionProgress" className="progress-bar bg-cashmere" role="progressbar" style={{ width: "50%" }} aria-valuemin={0} aria-valuemax={100} aria-valuenow={50}></div>
                </div>
            </p>
            <p className='small'>
                Start price: {props.startPrice} &#42793;<br/>
                End price: {props.endPrice} &#42793;
            </p>

            <p className='text-center fs-5'>Get for 2.0 &#42793;</p>
            <p className="text-center mb-0"><button className="btn btn-cashmere btn-md w-100">Place Bid</button></p>
        </div>
    );
}