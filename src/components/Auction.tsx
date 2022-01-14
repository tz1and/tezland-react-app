import { Link } from 'react-router-dom';
import { MapContainer, ImageOverlay } from 'react-leaflet'
import L from 'leaflet';
import './Auction.css'
import 'leaflet/dist/leaflet.css';

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
            <div className='p-3'>
                <img className="mx-auto mb-1 d-block" src="/logo192.png" alt="" width="48" height="48" />
                <p className="text-center mb-0">Auction place #{props.auctionId}</p>
            </div>
            <MapContainer className="auction-img" center={[500, 500]} zoom={1} attributionControl={false} dragging={false} zoomControl={false} scrollWheelZoom={false} crs={L.CRS.Simple} alt="A preview map of the land">
                <ImageOverlay bounds={[[0,0], [1000, 1000]]} url="/img/map.svg" />
            </MapContainer>
            <div className='p-3'>
                Start time / End time
                <div className="progress mb-3">
                    <div id="auctionProgress" className="progress-bar bg-primary" role="progressbar" style={{ width: "50%" }} aria-valuemin={0} aria-valuemax={100} aria-valuenow={50}></div>
                </div>

                <p className='small'>
                    Land area: 100 m<sup>2</sup><br/>
                    Current owner: <a href="https://tzkt.io/tz1UQpm4CRWUTY9GBxmU8bWR8rxMHCu7jxjV" target='_blank' rel='noreferrer'>{"tz1UQpm4CRWUTY9GBxmU8bWR8rxMHCu7jxjV".substring(0,10)}...</a><br/>
                    Start price: {props.startPrice} &#42793;<br/>
                    End price: {props.endPrice} &#42793;
                </p>

                <Link to='/explore?coordx=10&coordz=10' className="btn btn-outline-secondary btn-sm w-100 mb-1">Visit place</Link>
                <button className="btn btn-primary btn-md w-100">Get for 2.0 &#42793;</button>
            </div>
        </div>
    );
}