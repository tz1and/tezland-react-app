import React from 'react';
import { ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Link } from 'react-router-dom';
import Auction, { discordInviteLink } from '../components/Auction'
import TezosWalletContext from '../components/TezosWalletContext';
import { grapphQLUser } from '../graphql/user';
import DutchAuction from '../tz/DutchAuction';
import { Logging } from '../utils/Logging';
import { scrollbarVisible } from '../utils/Utils';

type AuctionTypeFilter = 'all' | 'primary' | 'secondary';

type AuctionsProps = {}

type AuctionsState = {
    auctions: Map<number, any>;
    more_data: boolean;
    firstFetchDone: boolean;
    last_auction_id: number;
    user_is_whitelisted: boolean;

    // global contract settings
    secondary_enabled: boolean;
    whitelist_enabled: boolean;
    administrator: string;

    show_finished: boolean;
    type_filter: AuctionTypeFilter;
}

class Auctions extends React.Component<AuctionsProps, AuctionsState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;

    constructor(props: AuctionsProps) {
        super(props);
        this.state = {
            auctions: new Map(),
            more_data: true,
            firstFetchDone: false,
            last_auction_id: 10000000,
            user_is_whitelisted: false,

            // defaults from the contract
            secondary_enabled: false,
            whitelist_enabled: true,
            administrator: "",
            show_finished: false,
            type_filter: 'all'
        };
    }

    private static FetchAmount: number = 8;

    private async getAuctions(last: number) {
        //query getAuctions($offset: Int!, $amount: Int!) {
        //    dutchAuction(offset: $offset, limit: $amount, order_by: {id: desc}) {
        // Fetch with a less than to make sure we get don't
        // load auctions twice because of new added and offset.
        // TODO: probably quite inefficient. find a way to avoid that. maybe a map? 
        try {
            const primaryFilter = this.state.type_filter === 'all' ?
                [] : this.state.type_filter === 'primary' ? [true] : [true, false];

            const res = await grapphQLUser.getAuctions({
                last: last, amount: Auctions.FetchAmount,
                finished: this.state.show_finished,
                primaryFilter: primaryFilter});
            
            return res.dutchAuction;
        } catch(e: any) {
            Logging.InfoDev("failed to fetch auctions: " + e.message);
            return []
        }
    }

    private walletChangeListener = () => {
        DutchAuction.isWhitelisted(this.context).then((is_whitelisted) => {
            this.setState({user_is_whitelisted: is_whitelisted});
        });
    }

    private async getAuctionSettings() {
        const secondary_enabled = await DutchAuction.isSecondaryMarketEnabled(this.context);
        const whitelist_enabled = await DutchAuction.isWhitelistEnabled(this.context);
        const administrator = await DutchAuction.getAdministrator(this.context);

        return [secondary_enabled, whitelist_enabled, administrator]
    }

    override componentDidMount() {
        this.context.walletEvents().addListener("walletChange", this.walletChangeListener);

        this.getAuctionSettings().then(([secondary_enabled, whitelist_enabled, administrator]) => {
            this.setState({
                secondary_enabled: secondary_enabled,
                whitelist_enabled: whitelist_enabled,
                administrator: administrator
            });
        });

        this.walletChangeListener();

        this.reloadAuctions();
    }

    override componentWillUnmount() {
        this.context.walletEvents().removeListener("walletChange", this.walletChangeListener);
    }

    override componentDidUpdate() {
        if(this.state.more_data && !scrollbarVisible(document.body)) {
            this.fetchMoreData();
        }
    }

    private removeFromAuctions = (auction_id: number) => {
        this.state.auctions.delete(auction_id);
        this.setState({auctions: this.state.auctions});

        this.walletChangeListener();
    }

    private reloadAuctions = () => {
        // TODO: first fetch should probably be by offset 0,
        // but we can also just use a very large id.
        this.getAuctions(10000000).then((res) => {
            const more_data = res.length === Auctions.FetchAmount;
            let last_auction_id = 0;
            const new_auctions = new Map<number, any>();
            for (const r of res) {
                new_auctions.set(r.id, r);
                last_auction_id = r.id;
            }

            this.setState({
                auctions: new_auctions,
                more_data: more_data,
                firstFetchDone: true,
                last_auction_id: last_auction_id
            });
        });
    }

    private fetchMoreData = () => {
        if(this.state.firstFetchDone && this.state.more_data) {
            this.getAuctions(this.state.last_auction_id).then((res) => {
                const more_data = res.length === Auctions.FetchAmount;
                let last_auction_id = 0;
                for (const r of res) {
                    this.state.auctions.set(r.id, r);
                    last_auction_id = r.id;
                }

                this.setState({
                    auctions: this.state.auctions,
                    more_data: more_data,
                    last_auction_id: last_auction_id
                });
            });
        }
    }

    private parseTimestamp(t: string): number {
        return Math.floor(Date.parse(t) / 1000);
    }

    private handleActiveFilter(value: any, event: any) {
        Logging.InfoDev("handleActiveFilter");
        Logging.InfoDev(value, event);

        const event_checked = event.currentTarget.checked;
        const event_value: string = event.currentTarget.value;

        Logging.InfoDev(event_checked, event_value);

        this.setState({ show_finished: event_value !== 'active' }, () => { this.reloadAuctions() });
    }

    private handleSecondaryFilter(value: any, event: any) {
        Logging.InfoDev("handleSecondaryFilter");
        Logging.InfoDev(value, event);

        const event_checked = event.currentTarget.checked;
        const event_value = event.currentTarget.value as AuctionTypeFilter;

        Logging.InfoDev(event_checked, event_value);

        this.setState({ type_filter: event_value }, () => { this.reloadAuctions() });
    }

    override render() {
        var rows = [];
       this.state.auctions.forEach((auction) => {
            rows.push(<Auction key={auction.id} auctionId={auction.id} startPrice={auction.startPrice} endPrice={auction.endPrice} isPrimary={auction.isPrimary}
                startTime={this.parseTimestamp(auction.startTime)} endTime={this.parseTimestamp(auction.endTime)} owner={auction.ownerId} tokenId={auction.tokenId}
                finished={auction.finished} finishingBid={auction.finishingBid} bidOpHash={auction.bidOpHash}
                userWhitelisted={this.state.user_is_whitelisted} removeFromAuctions={this.removeFromAuctions} />);
        });

        if(rows.length === 0) {
            rows.push(<div key={0} className='mt-5 mb-5'>It looks like there aren't any active auctions. Check back later :)</div>)
        }

        return (
            <main>
                <div className="position-relative container text-start mt-4">
                    <h1>Place Auctions</h1>
                    <p>This is the <i>primary</i> (newly minted Places will end up here) and{!this.state.secondary_enabled && " - when it will be enabled -"} also a secondary (everyone can create auctions) marketplace for Places.</p>
                    <p>Listings are price drop (dutch) auctions, the price lowering continually to an end price. Auctions remain active unless cancelled, they can be cancelled by the creator before a bid.</p>
                    <p>Price drops once every 60 seconds. There is a 2.5% management fee on successful bids.</p>
                    { this.state.whitelist_enabled ? <p><b>For primary actions, you currently need to be apply. Join the <a href={discordInviteLink} target="_blank" rel="noreferrer">Discord</a> to apply for a primary.</b></p> : null }
                    { this.state.secondary_enabled || DutchAuction.isAdministrator(this.context, this.state.administrator) ? <Link to='/auctions/create' className='position-absolute btn btn-primary top-0 end-0'>Create Auction</Link> : null}
                    <p className='bg-info rounded p-2'>Please be aware that the price for <i>primary listings</i> is intended to be below 60tez. It may be worth waiting.</p>
                    <p className='bg-warning rounded p-2'>Item ownership <i>does not</i> transfer with the place.</p>

                    <ToggleButtonGroup className='me-2' type='radio' name='auctionStateFilter' defaultValue='active' onChange={(v, e) => this.handleActiveFilter(v, e)}>
                        <ToggleButton id='radioStateActive' type="radio" variant='outline-primary' value='active'>Active</ToggleButton>
                        <ToggleButton id='radioStateFinished' type="radio" variant='outline-primary' value='finished'>Finished</ToggleButton>
                    </ToggleButtonGroup>

                    <ToggleButtonGroup type='radio' name='auctionTypeFilter' defaultValue='all' onChange={(v, e) => this.handleSecondaryFilter(v, e)}>
                        <ToggleButton id='radioFilterAll' type="radio" variant='outline-primary' value='all'>All</ToggleButton>
                        <ToggleButton id='radioFilterPrimary' type="radio" variant='outline-primary' value='primary'>Primary</ToggleButton>
                        <ToggleButton id='radioFilterSecondary' type="radio" variant='outline-primary' value='secondary'>Secondary</ToggleButton>
                    </ToggleButtonGroup>

                    <hr/>
                    <InfiniteScroll
                        className="d-flex justify-content-left flex-wrap p-2"
                        dataLength={this.state.auctions.size} //This is important field to render the next data
                        next={this.fetchMoreData}
                        hasMore={this.state.more_data}
                        loader={<h4>Loading...</h4>}
                        scrollThreshold={1.0}
                    >
                        {rows}
                    </InfiniteScroll>
                </div>

            </main>
        );
    }
}

export default Auctions;