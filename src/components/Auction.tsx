import { Link } from 'react-router-dom';
import { MapContainer, ImageOverlay, Circle, Polygon } from 'react-leaflet'
import L from 'leaflet';
import './Auction.css'
import 'leaflet/dist/leaflet.css';
import { mutezToTez, signedArea } from '../utils/Utils';
import { MapSetCenter } from '../forms/CreateAuction';
import React from 'react';
import Metadata from '../world/Metadata';
import TezosWalletContext from './TezosWalletContext';
import DutchAuction from '../tz/DutchAuction';

type AuctionProps = {
    auctionId: number;
    startPrice: number;
    endPrice: number; // im mutez
    startTime: number; // in mutez
    endTime: number;
    owner: string;
    tokenId: number;
    reloadAuctions(): void;
    removeFromAuctions(auction_id: number): void;
    // using `interface` is also ok
    //message: string;
};

type AuctionState = {
    updateCount: number,
    mapLocation: [number, number],
    placePoly: [number, number][],
    placeCoords: [number, number],
    placeArea: number
}

export default class Auction extends React.Component<AuctionProps, AuctionState> {
    static contextType = TezosWalletContext;
    context!: React.ContextType<typeof TezosWalletContext>;
    
    constructor(props: AuctionProps) {
        super(props);
        this.state = {
            updateCount: 0,
            mapLocation: [500, 500],
            placePoly: [],
            placeCoords: [0, 0],
            placeArea: 0,
        };
        this.updateTimeVars();
    }

    private duration: number = this.props.endTime - this.props.startTime;
    private current_time: number = 0;
    private started: boolean = false;
    private since_start: number = 0;
    private progress: number = 0;

    private refreshInterval: NodeJS.Timeout | null = null;
    private reloadInterval: NodeJS.Timeout | null = null;

    private updateTimeVars() {
        this.current_time = Math.floor(Date.now() / 1000);
        this.started = this.current_time >= this.props.startTime;
        this.since_start = Math.min(this.current_time, this.props.endTime) - this.props.startTime;
        this.progress = Math.min(100 - this.since_start / this.duration * 100, 100);
    }

    // returns current price in mutez
    private calculateCurrentPrice(): number {
        if(this.current_time >= this.props.endTime) return this.props.endPrice;

        const granularity = 60; // seconds
        // From the auction contract code.
        // Always to simulate integer division.
        const duration_g = Math.floor(this.duration / granularity);
        const time_since_start_g = Math.floor(this.since_start / granularity);
        const mutez_per_interval = Math.floor((this.props.startPrice - this.props.endPrice) / duration_g);
        const time_deduction = mutez_per_interval * time_since_start_g;

        const current_price = this.props.startPrice - time_deduction;
        return current_price;
    }

    private bidOnAuction = async () => {
        await DutchAuction.bidOnAuction(this.context, this.props.auctionId, this.calculateCurrentPrice(), () => {
            // Wait a little for the indexer to catch up.
            this.reloadInterval = setTimeout(() => {
                this.props.removeFromAuctions(this.props.auctionId);
            }, 2000);
        });
    }

    private panMapToPlace(place_id: number) {
        Metadata.getPlaceMetadata(place_id).then((res) => {
            const coords = res.token_info.center_coordinates;
            const center_pos: [number, number] = [500 + -coords[2], 500 + coords[0]];

            const polygon = res.token_info.border_coordinates;
            const placePoly: [number, number][] = [];
            const areaPoly: number[] = [];
            for(const pos of polygon)
            {
                placePoly.push([center_pos[0] + -pos[2], center_pos[1] + pos[0]]);
                areaPoly.push(pos[0], pos[2]);
            }

            this.setState({
                mapLocation: center_pos,
                placePoly: placePoly,
                placeCoords: [coords[0], coords[2]],
                placeArea: Math.abs(signedArea(areaPoly, 0, areaPoly.length, 2))
            });
        })
    }

    componentDidMount() {
        // set Interval
        this.refreshInterval = setInterval(() => {
            this.updateTimeVars();
            this.setState({ updateCount: this.state.updateCount + 1 });
        }, 10000);

        this.panMapToPlace(this.props.tokenId);
    }
    
    componentWillUnmount() {
        // Clear the interval right before component unmount
        if(this.refreshInterval) clearInterval(this.refreshInterval);
        if(this.reloadInterval) clearInterval(this.reloadInterval);
    }

    render() {
        return (
            <div className="m-3 Auction">
                <div className='p-3'>
                    <img className="mx-auto mb-1 d-block" src="/logo192.png" alt="" width="48" height="48" />
                    <h4 className="text-center mb-0">Place #{this.props.tokenId}</h4>
                    <small className='text-center d-block mb-0'>Auction #{this.props.auctionId}</small>
                </div>
                <MapContainer className="auction-img" center={[500, 500]} zoom={2} attributionControl={false} dragging={false} zoomControl={false} scrollWheelZoom={false} crs={L.CRS.Simple} alt="A preview map of the land">
                    <ImageOverlay bounds={[[0, 0], [1000, 1000]]} url="/img/map.svg" />
                    <MapSetCenter center={this.state.mapLocation} animate={false} />
                    <Circle center={this.state.mapLocation} radius={1.5} color='#d58195' fillColor='#d58195' fill={true} fillOpacity={1} />
                    <Polygon positions={this.state.placePoly} color='#d58195' weight={10} lineCap='square'/>
                </MapContainer>
                <div className='p-3'>
                    <div className="progress mb-3">
                        <div id="auctionProgress" className="progress-bar bg-primary" role="progressbar" style={{ width: `${this.progress}%` }} aria-valuemin={0} aria-valuemax={100} aria-valuenow={this.progress}></div>
                    </div>

                    <p className='small'>
                        Land area: {this.state.placeArea.toFixed(2)} m<sup>2</sup><br/>
                        Current owner: <a href={`https://tzkt.io/${this.props.owner}`} target='_blank' rel='noreferrer'>{this.props.owner.substring(0,12)}...</a><br/>
                        Start price: {mutezToTez(this.props.startPrice).toNumber()} &#42793;<br/>
                        End price: {mutezToTez(this.props.endPrice).toNumber()} &#42793;<br/>
                        Duration: {this.duration / 3600}h
                    </p>

                    <Link to={`/explore?coordx=${this.state.placeCoords[0]}&coordz=${this.state.placeCoords[1]}`} target='_blank' className="btn btn-outline-secondary btn-sm w-100 mb-1">Visit place</Link>
                    <button onClick={this.bidOnAuction} className="btn btn-primary btn-md w-100" disabled={!this.started}>
                        {!this.started ? "Not started" : "Get for ~" + mutezToTez(this.calculateCurrentPrice()).toNumber().toFixed(2) + " \uA729"}</button>
                </div>
            </div>
        );
    }
}