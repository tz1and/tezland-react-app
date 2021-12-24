import Auction from '../components/Auction'

export default function Auctions() {
    var rows = [];
    for (var i = 0; i < 10; i++) {
        // note: we are adding a key prop here to allow react to uniquely identify each
        // element in this array. see: https://reactjs.org/docs/lists-and-keys.html
        rows.push(<Auction key={i} auctionId={i} startPrice={10} endPrice={2} />);
    }

    return (
        <main>
            <div className="container text-start pt-4">
                <h1>Active Auctions</h1>
                <p>All place auctions are dutch auctions, with the price lowering continually.</p>
                <hr/>
                <div className="d-flex justify-content-center flex-wrap p-2">
                    {rows}
                </div>
            </div>

        </main>
    );
}