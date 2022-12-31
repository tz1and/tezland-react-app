import { Link } from 'react-router-dom';
import './Auction.css'
import 'leaflet/dist/leaflet.css';
import { mutezToTez, signedArea } from '../utils/Utils';
import React from 'react';
import Metadata from '../world/Metadata';
import TezosWalletContext from './TezosWalletContext';
import DutchAuction from '../tz/DutchAuction';
import { Button, Modal, OverlayTrigger, Popover } from 'react-bootstrap';
import assert from 'assert';
import { Place } from '../routes/directory/Place';
import PlaceKey from '../utils/PlaceKey';


type AuctionDetailsProps = {
    placeKey: PlaceKey;
    auctionId: number;
    startPrice: number;
    endPrice: number; // im mutez
    startTime: number; // in mutez
    endTime: number;
    owner: string;
    isPrimary: boolean;
    userWhitelisted: boolean;
    finished: boolean;
    finishingBid: number;
    bidOpHash?: string;
    // using `interface` is also ok
    //message: string;
    onHide: () => void;
};

type AuctionDetailsState = {
    updateCount: number,
    mapLocation: [number, number],
    placePoly: [number, number][],
    placeCoords: [number, number],
    placeArea: number,
    buildHeight: number,
    seqHash: string,
}

export const discordInviteLink = "https://discord.gg/AAwpbStzZf";

export default class AuctionDetails extends React.Component<AuctionDetailsProps, AuctionDetailsState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;
    
    constructor(props: AuctionDetailsProps) {
        super(props);
        this.state = {
            updateCount: 0,
            mapLocation: [1000, 1000],
            placePoly: [],
            placeCoords: [0, 0],
            placeArea: 0,
            buildHeight: 0,
            seqHash: ""
        };
        this.updateTimeVars();
    }

    private duration: number = this.props.endTime - this.props.startTime;
    private current_time: number = 0;
    private started: boolean = false;
    private since_start: number = 0;
    private progress: number = 0;

    private refreshInterval: NodeJS.Timeout | null = null;
    private reloadTimeout: NodeJS.Timeout | null = null;

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
        await DutchAuction.bidOnAuction(this.context, this.props.placeKey, this.props.owner, this.calculateCurrentPrice(), this.state.seqHash);
    }

    private cancelAuction = async () => {
        await DutchAuction.cancelAuction(this.context, this.props.placeKey, this.props.owner);
    }

    private panMapToPlace() {
        // Note: To match leaflet coords, both x and y are flipped and mirrored.
        Metadata.getPlaceMetadata(this.props.placeKey.id, this.props.placeKey.fa2).then((res) => {
            assert(res);
            const coords = res.centerCoordinates;
            const center_pos: [number, number] = [1000 + -coords[2], 1000 + -coords[0]];

            const polygon = res.borderCoordinates;
            const placePoly: [number, number][] = [];
            const areaPoly: number[] = [];
            for(const pos of polygon)
            {
                placePoly.push([center_pos[0] + -pos[2], center_pos[1] + -pos[0]]);
                areaPoly.push(pos[0], pos[2]);
            }

            this.setState({
                mapLocation: center_pos,
                placePoly: placePoly,
                placeCoords: [coords[0], coords[2]],
                placeArea: Math.abs(signedArea(areaPoly, 0, areaPoly.length, 2)),
                buildHeight: res.buildHeight
            });
        })
    }

    private placeLink(): string {
        return `/explore?placekey=${this.props.placeKey.fa2},${this.props.placeKey.id}`;
    }

    override componentDidMount() {
        this.panMapToPlace();

        if (!this.props.finished) {
            // set Interval
            // NOTE: could figure out the exact time the price drops by granularity
            // and wait until then. But probably better to update the progress bar
            // every now and then.
            this.refreshInterval = setInterval(() => {
                this.updateTimeVars();
                this.setState({ updateCount: this.state.updateCount + 1 });
            }, 10000);

            DutchAuction.getHashedPlaceSeq(this.context, this.props.placeKey).then(res => {
                this.setState({seqHash: res});
            });
        }
    }
    
    override componentWillUnmount() {
        // Clear the interval right before component unmount
        if(this.refreshInterval) clearInterval(this.refreshInterval);
        if(this.reloadTimeout) clearTimeout(this.reloadTimeout);
    }

    override render() {
        let price_str = "";
        if (this.props.finished) {
            price_str = mutezToTez(this.props.finishingBid).toNumber().toFixed(2) + " \uA729";
        } else {
            const current_price = this.calculateCurrentPrice();
            const is_approximate_price = this.props.startPrice !== current_price && this.props.endPrice !== current_price;
            price_str = (is_approximate_price ? "~" : "") + mutezToTez(current_price).toNumber().toFixed(2) + " \uA729";
        }

        // TODO: fix this to update dynamically.
        const time_left = (this.props.endTime - Math.floor(Date.now() / 1000)) / 3600;

        const detail_override = <div>
            <div className='mb-3 text-center'>
                <img className="mx-auto mb-1 d-block" src="/logo192.png" alt="" width="48" height="48" />
                <h4 className="mb-0">{DutchAuction.getPlaceType(this.props.placeKey.fa2)} #{this.props.placeKey.id}</h4>
                <small className='d-block mb-0'></small>
                <Link to={this.placeLink()} target='_blank' className="btn btn-outline-secondary btn-sm mt-1">Visit place</Link>
            </div>
            <OverlayTrigger
                placement={"top"}
                overlay={
                    <Popover>
                        <Popover.Body>
                            {`Time left: ${time_left > 0 ? time_left.toFixed(1) : "0"}h`}
                        </Popover.Body>
                    </Popover>
                }
            >
                {this.props.finished ? 
                    <div className="progress mb-3">
                        <div id="auctionProgress" className="progress-bar bg-success" role="progressbar" style={{ width: '100%' }} aria-valuemin={0} aria-valuemax={100} aria-valuenow={100}></div>
                    </div> :
                    <div className="progress mb-3">
                        <div id="auctionProgress" className="progress-bar bg-primary" role="progressbar" style={{ width: `${this.progress}%` }} aria-valuemin={0} aria-valuemax={100} aria-valuenow={this.progress}></div>
                    </div>
                }
            </OverlayTrigger>
            <p className='small mb-2'>
                <h4>Auction Details</h4>
                Place area: {this.state.placeArea.toFixed(2)} m<sup>2</sup><br/>
                Build height: {this.state.buildHeight.toFixed(2)} m<br/>
                Auction owner: <a href={`https://tzkt.io/${this.props.owner}`} target='_blank' rel='noreferrer'>{this.props.owner.substring(0,12)}...</a><br/>
                Start price: {mutezToTez(this.props.startPrice).toNumber()} &#42793;<br/>
                End price: {mutezToTez(this.props.endPrice).toNumber()} &#42793;<br/>
                Duration: {this.duration / 3600}h
            </p>

            <h6>{(this.props.finished ? "Final bid: " : "Current bid: ") + price_str}</h6>
        </div>

        return (
        <Modal
            show={true}
            size="xl"
            aria-labelledby="contained-modal-title-vcenter"
            centered
            onHide={this.props.onHide}
        >
            <Modal.Header closeButton>
                <Modal.Title id="contained-modal-title-vcenter">
                    Auction #{this.props.auctionId}
                </Modal.Title>
            </Modal.Header>
                <Modal.Body>
                    {this.props.isPrimary ? <Button variant="outline-success ms-3" disabled={true}>Primary Auction</Button> :
                        <Button variant="outline-secondary ms-3" disabled={true}>Secondary Auction</Button>}

                    <Place placeKey={this.props.placeKey} onlyPlaceOwnedItems={true} detailOverride={detail_override} mapSize={["480px", "360px"]} />
                </Modal.Body>
                <Modal.Footer>
                    {this.props.finished ? <a className="btn btn-success btn-md" href={`https://tzkt.io/${this.props.bidOpHash}`} target='_blank' rel='noreferrer'>Finished</a> :
                        !this.context.isWalletConnected() ? <Button className="mb-1" variant="secondary" disabled={true}>Connect wallet to place bid</Button> :
                            (this.props.isPrimary && !this.props.userWhitelisted) ? <a href={discordInviteLink} target="_blank" rel="noreferrer" className="btn btn-warning btn-md mb-1">Apply for Primary</a> :
                            <Button onClick={this.bidOnAuction} className="mb-1" variant="primary" disabled={!this.started}>
                                {!this.started ? "Not started" : "Get Place for " + price_str}</Button>}

                    {!this.props.finished && (this.context.isWalletConnected() && this.props.owner === this.context.walletPHK()) &&
                        <Button onClick={this.cancelAuction} className="mb-1" variant="outline-danger">Cancel Auction</Button>}
                </Modal.Footer>
            </Modal>
        );
    }
}