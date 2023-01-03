import { Link } from 'react-router-dom';
import './Auction.css'
import { mutezToTez } from '../utils/Utils';
import React from 'react';
import TezosWalletContext from './TezosWalletContext';
import DutchAuction from '../tz/DutchAuction';
import { Button, Modal, OverlayTrigger, Popover, Table } from 'react-bootstrap';
import { Place } from '../routes/directory/Place';
import { BaseAuctionProps, BaseAuctionState, BaseAuction } from './BaseAuction';
import Conf from '../Config';
import { DirectoryUtils } from '../utils/DirectoryUtils';


type AuctionDetailsProps = {
    onHide: () => void;
};

type AuctionDetailsState = {
    updateCount: number,
    seqHash: string
} & BaseAuctionState

export default class AuctionDetails extends BaseAuction<AuctionDetailsProps, AuctionDetailsState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;
    
    constructor(props: BaseAuctionProps & AuctionDetailsProps) {
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
    }

    private refreshInterval: NodeJS.Timeout | null = null;
    private reloadTimeout: NodeJS.Timeout | null = null;

    private bidOnAuction = async () => {
        await DutchAuction.bidOnAuction(this.context, this.props.placeKey, this.props.owner, this.calculateCurrentPrice(), this.state.seqHash);
    }

    private cancelAuction = async () => {
        await DutchAuction.cancelAuction(this.context, this.props.placeKey, this.props.owner);
    }

    private panMapToPlace() {
        this.getPlaceState().then(res => {
            this.setState(res);
        });
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
            <div className='mb-2'>
                <h4>Auction Details</h4>
                {this.auctionTypeLabel("mb-2 me-1")} <Link to={this.placeLink()} target='_blank' className="btn btn-outline-secondary btn-sm mb-2">Visit place</Link><br/>
                <Table>
                    <tbody>
                        <tr>
                            <td>Place Area</td>
                            <td>{this.state.placeArea.toFixed(2)} m<sup>2</sup></td>
                        </tr>
                        <tr>
                            <td>Build Height</td>
                            <td>{this.state.buildHeight.toFixed(2)} m</td>
                        </tr>
                        <tr>
                            <td>Auction Owner</td>
                            <td>{DirectoryUtils.userLinkElement(this.props.owner, true)}</td>
                        </tr>
                        <tr>
                            <td>Start/End Price</td>
                            <td>{mutezToTez(this.props.startPrice).toNumber()} &#42793; / {mutezToTez(this.props.endPrice).toNumber()} &#42793;</td>
                        </tr>
                        <tr>
                            <td>Duration</td>
                            <td>{this.duration / 3600}h</td>
                        </tr>
                    </tbody>
                </Table>
                Progress:
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
                    <div className="progress mt-3 mb-3">
                        <div id="auctionProgress" className="progress-bar bg-primary" role="progressbar" style={{ width: `${this.progress}%` }} aria-valuemin={0} aria-valuemax={100} aria-valuenow={this.progress}></div>
                    </div>
                </OverlayTrigger>
            </div>

            <h5>{"Current bid: " + price_str}</h5>

            <small>Includes items listed below.</small>
        </div>

        const footer_buttons: JSX.Element[] = [];

        // If finished, add finished button/link.
        if (this.props.finished) {
            footer_buttons.push(<a key="finished-button" className="btn btn-success btn-md" href={`https://tzkt.io/${this.props.bidOpHash}`} target='_blank' rel='noreferrer'>Finished</a>);
        }
        else {
            if (this.context.isWalletConnected()) {
                // If owner, add cancel button.
                if (this.props.owner === this.context.walletPHK()) {
                    footer_buttons.push(<Button key="cancel-button" onClick={this.cancelAuction} className="mb-1" variant="outline-danger">Cancel Auction</Button>);
                }
                else {
                    // If not whitelisted, add whitelist button
                    if (this.props.isPrimary && !this.props.userWhitelisted) {
                        footer_buttons.push(<a key="whitelist-button" href={Conf.discordInviteLink} target="_blank" rel="noreferrer" className="btn btn-warning btn-md mb-1">Apply for Primary</a>);
                    }
                    else {
                        // Finally, add the bid button.
                        footer_buttons.push(<Button key="bid-button" onClick={this.bidOnAuction} className="mb-1" variant="primary" disabled={!this.started}>
                            {!this.started ? "Not started" : "Get Place for " + price_str}</Button>)
                    }
                }
            }
            else {
                // Add connect button
                footer_buttons.push(<Button key="connect-button" onClick={() => this.context.connectWallet()} className="mb-1" variant="secondary">Connect wallet to place bid</Button>);
            }
        }

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
                    <Place placeKey={this.props.placeKey} onlyPlaceOwnedItems={true} detailOverride={detail_override} openLinksInNewTab={true} />
                </Modal.Body>
                <Modal.Footer>
                    {footer_buttons}
                </Modal.Footer>
            </Modal>
        );
    }
}