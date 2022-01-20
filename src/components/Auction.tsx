import { Link } from 'react-router-dom';
import { MapContainer, ImageOverlay } from 'react-leaflet'
import L from 'leaflet';
import './Auction.css'
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { mutezToTez } from '../tz/Utils';
import Contracts from '../tz/Contracts';

type AuctionProps = {
    auctionId: number;
    startPrice: number;
    endPrice: number; // im mutez
    startTime: number; // in mutez
    endTime: number;
    owner: string;
    tokenId: string;
    reloadAuctions(): void;
    // using `interface` is also ok
    //message: string;
  };

export default function Auction(props: AuctionProps) {
    const [updateCount, setUpdateCount] = useState(0);

    const duration = props.endTime - props.startTime;
    const current_time = Math.floor(Date.now() / 1000);
    const started = current_time >= props.startTime;
    const since_start = Math.min(current_time, props.endTime) - props.startTime;
    const progress = 100 - Math.floor(since_start / duration * 100);

    // returns current price in mutez
    const calculateCurrentPrice = (): number => {
        if(current_time >= props.endTime) return props.endPrice;

        const granularity = 60; // seconds
        // From the auction contract code.
        // Always to simulate integer division.
        const duration_g = Math.floor(duration / granularity);
        const time_since_start_g = Math.floor(since_start / granularity);
        const mutez_per_interval = Math.floor((props.startPrice - props.endPrice) / duration_g);
        const time_deduction = mutez_per_interval * time_since_start_g;

        const current_price = props.startPrice - time_deduction;
        return current_price;
    }

    const bidOnAuction = async () => {
        await Contracts.bidOnAuction(props.auctionId, calculateCurrentPrice());
        
        // Wait a little for the indexer to catch up.
        // TODO: figure out if what happens when you navigate away from
        // the page before timeout triggers.
        setTimeout(() => {
            props.reloadAuctions();
        }, 5000);
    }

    useEffect(() => {
        const interval = setInterval(() => {
          setUpdateCount(updateCount + 1);
        }, 10000);
        return () => clearInterval(interval);
    });

    return (
        <div className="m-3 Auction">
            <div className='p-3'>
                <img className="mx-auto mb-1 d-block" src="/logo192.png" alt="" width="48" height="48" />
                <h4 className="text-center mb-0">Place #{props.tokenId}</h4>
                <small className='text-center d-block mb-0'>Auction #{props.auctionId}</small>
            </div>
            <MapContainer className="auction-img" center={[500, 500]} zoom={1} attributionControl={false} dragging={false} zoomControl={false} scrollWheelZoom={false} crs={L.CRS.Simple} alt="A preview map of the land">
                <ImageOverlay bounds={[[0,0], [1000, 1000]]} url="/img/map.svg" />
            </MapContainer>
            <div className='p-3'>
                <div className="progress mb-3">
                    <div id="auctionProgress" className="progress-bar bg-primary" role="progressbar" style={{ width: `${progress}%` }} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}></div>
                </div>

                <p className='small'>
                    Land area: 100 m<sup>2</sup><br/>
                    Current owner: <a href={`https://tzkt.io/${props.owner}`} target='_blank' rel='noreferrer'>{props.owner.substring(0,12)}...</a><br/>
                    Start price: {mutezToTez(props.startPrice).toNumber()} &#42793;<br/>
                    End price: {mutezToTez(props.endPrice).toNumber()} &#42793;<br/>
                    Duration: {duration / 3600}h
                </p>

                <Link to='/explore?coordx=10&coordz=10' className="btn btn-outline-secondary btn-sm w-100 mb-1">Visit place</Link>
                <button onClick={bidOnAuction} className="btn btn-primary btn-md w-100" disabled={!started}>{!started ? "Not started" : "Get for ~" + mutezToTez(calculateCurrentPrice()).toNumber().toFixed(2) + " \uA729"}</button>
            </div>
        </div>
    );
}