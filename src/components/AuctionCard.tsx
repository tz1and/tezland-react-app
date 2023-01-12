import { Link } from 'react-router-dom';
import './Auction.css'
import { mutezToTez } from '../utils/Utils';
import React from 'react';
import TezosWalletContext from './TezosWalletContext';
import DutchAuction from '../tz/DutchAuction';
import { Button, OverlayTrigger, Popover } from 'react-bootstrap';
import AuctionDetails from './AuctionDetails';
import { getPlaceName, getPlaceType, PlaceType } from '../utils/PlaceKey';
import { WorldMap2D } from "./WorldMap2D";
import { DirectoryUtils } from '../utils/DirectoryUtils';
import { BaseAuction, BaseAuctionProps, BaseAuctionState } from './BaseAuction';


type AuctionCardProps = { };

type AuctionCardState = {
    updateCount: number,
    showAuctionDetails: boolean
} & BaseAuctionState

export default class AuctionCard extends BaseAuction<AuctionCardProps, AuctionCardState> {
    static override contextType = TezosWalletContext;
    declare context: React.ContextType<typeof TezosWalletContext>;

    constructor(props: AuctionCardProps & BaseAuctionProps) {
        super(props);
        this.state = {
            updateCount: 0,
            mapLocation: [1000, 1000],
            placePoly: [],
            placeCoords: [0, 0],
            placeArea: 0,
            buildHeight: 0,
            showAuctionDetails: false
        };
    }

    private refreshInterval: NodeJS.Timeout | null = null;
    private reloadTimeout: NodeJS.Timeout | null = null;

    private openAuctionDetails = () => {
        this.setState({showAuctionDetails: true});
    }

    private cancelAuction = async () => {
        await DutchAuction.cancelAuction(this.context, this.props.placeKey, this.props.owner);
    }

    private panMapToPlace() {
        this.getPlaceState().then(res => {
            this.setState(res);
        });
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

        const placeType = getPlaceType(this.props.placeKey.fa2);

        return (
            <div className="m-3 Auction position-relative">
                {!this.props.finished && (this.context.isWalletConnected() && this.props.owner === this.context.walletPHK()) &&
                    <Button onClick={this.cancelAuction} className="position-absolute mt-3 me-3 end-0" size="sm" variant="outline-danger">Cancel</Button>}

                {this.auctionTypeLabel("position-absolute mt-3 ms-3")}

                <div className='p-3 text-center'>
                    <img className="mx-auto mb-1 d-block" src="/logo192.png" alt="" width="48" height="48" />
                    <h4 className="mb-0">{getPlaceName(this.props.placeKey)}</h4>
                    <small className='d-block mb-0'>Auction #{this.props.auctionId}</small>
                    <Link to={DirectoryUtils.placeExploreLink(this.props.placeKey)} target='_blank' className="btn btn-outline-secondary btn-sm mt-1">Visit place</Link>
                </div>
                <WorldMap2D mapClass="auction-img" isExteriorPlace={placeType !== PlaceType.Interior} style={{}} location={this.state.mapLocation} placePoly={this.state.placePoly} zoom={1} zoomControl={true} animate={false} />
                <div className='p-3'>
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
                        Place area: {this.state.placeArea.toFixed(2)} m<sup>2</sup><br/>
                        Build height: {this.state.buildHeight.toFixed(2)} m<br/>
                        Auction owner: {DirectoryUtils.userLinkElement(this.props.owner, true)}<br/>
                        Start price: {mutezToTez(this.props.startPrice).toNumber()} &#42793;<br/>
                        End price: {mutezToTez(this.props.endPrice).toNumber()} &#42793;<br/>
                        Duration: {this.duration / 3600}h
                    </p>

                    <h6 className='text-center'>{(this.props.finished ? "Final bid: " : "Current bid: ") + price_str}</h6>

                    {this.props.finished ? <a className="btn btn-success btn-md w-100" href={`https://tzkt.io/${this.props.bidOpHash}`} target='_blank' rel='noreferrer'>Finished</a> :
                        <Button onClick={this.openAuctionDetails} className="mb-1 w-100" variant="primary">Details</Button>}
                </div>
                {this.state.showAuctionDetails && <AuctionDetails {...this.props} onHide={() => {this.setState({showAuctionDetails: false})}} />}
            </div>
        );
    }
}