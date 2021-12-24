import { Link } from 'react-router-dom';
import Auction from '../components/Auction'

export default function Auctions() {
    var rows = [];
    for (var i = 0; i < 10; i++) {
        rows.push(<Auction key={i} auctionId={i} startPrice={10} endPrice={2} />);
    }

    if(rows.length === 0) {
        rows.push(<div className='mt-5 mb-5'>It looks like there aren't any active auctions. Check back later :)</div>)
    }

    return (
        <main>
            <div className="container text-start pt-4">
                <h1>Active Land Auctions</h1>
                <p>All auctions are dutch auctions, with the price lowering continually.</p>
                <Link to='/auctions/create' className='btn btn-cashmere'>Create Auction</Link>
                <hr/>
                <div className="d-flex justify-content-left flex-wrap p-2">
                    {rows}
                </div>
            </div>

        </main>
    );
}