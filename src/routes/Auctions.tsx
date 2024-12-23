import { Contract, OperationContent, PollingSubscribeProvider, Subscription } from '@taquito/taquito';
import { OperationContentsAndResultTransaction } from '@taquito/rpc';
import { ParameterSchema } from '@taquito/michelson-encoder';
import React from 'react';
import { Col, Container, Row, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import { Helmet } from 'react-helmet-async';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Link } from 'react-router-dom';
import AuctionCard from '../components/AuctionCard';
import TezosWalletContext from '../components/TezosWalletContext';
import Conf from '../Config';
import { grapphQLUser } from '../graphql/user';
import DutchAuction, { AuctionKey, isPlaceAllowedToTrade } from '../tz/DutchAuction';
import { Logging } from '../utils/Logging';
import { scrollbarVisible } from '../utils/Utils';
import PlaceKey from '../utils/PlaceKey';


type AuctionTypeFilter = 'all' | 'primary' | 'secondary';
const defaultAuctionTypeFilter: AuctionTypeFilter = 'primary';

type AuctionsProps = {}

type AuctionsState = {
    auctions: Map<string, any>;
    more_data: boolean;
    firstFetchDone: boolean;
    last_auction_id: number;
    user_is_whitelisted_places: boolean;
    user_is_whitelisted_interiors: boolean;

    // global contract settings
    secondary_enabled: boolean;
    whitelist_settings_places: [boolean, string];
    whitelist_settings_interiors: [boolean, string];

    show_finished: boolean;
    type_filter: AuctionTypeFilter;

    operation_subscription: Subscription<OperationContent> | undefined;
    auctions_contract: Contract | undefined;
}

class Auctions extends React.Component<AuctionsProps, AuctionsState> {
    static override contextType = TezosWalletContext;
    declare context: React.ContextType<typeof TezosWalletContext>;

    constructor(props: AuctionsProps) {
        super(props);
        this.state = {
            auctions: new Map(),
            more_data: true,
            firstFetchDone: false,
            last_auction_id: 10000000,
            user_is_whitelisted_places: false,
            user_is_whitelisted_interiors: false,

            // defaults from the contract
            secondary_enabled: false,
            whitelist_settings_places: [true, ""],
            whitelist_settings_interiors: [true, ""],
            show_finished: false,
            type_filter: defaultAuctionTypeFilter,

            operation_subscription: undefined,
            auctions_contract: undefined
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
                [true, false] : this.state.type_filter === 'primary' ? [true] : [false];

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
        DutchAuction.isWhitelisted(this.context, Conf.place_contract).then((is_whitelisted) => {
            this.setState({user_is_whitelisted_places: is_whitelisted});
        });

        DutchAuction.isWhitelisted(this.context, Conf.interior_contract).then((is_whitelisted) => {
            this.setState({user_is_whitelisted_interiors: is_whitelisted});
        });
    }

    private async subscribeToAuctionBids(auctions_contract: Contract) {
        this.context.tezosToolkit().setStreamProvider(this.context.tezosToolkit().getFactory(PollingSubscribeProvider)({
            shouldObservableSubscriptionRetry: true,
            pollingIntervalMilliseconds: 5000 // NOTE: getting random failures with 20000
        }));

        try {
            const auctionsOperation = {
                and: [{ destination: auctions_contract.address }, { kind: 'transaction' }]
            }

            const sub = this.context.tezosToolkit().stream.subscribeOperation(auctionsOperation);
            return sub;
        }
        catch (e) {
            Logging.Error(e);
        }

        return;
    }

    private async registerAuctionSubscription() {
        const auctions_contract = await this.context.tezosToolkit().contract.at(Conf.dutch_auction_contract);
        const subscription = await this.subscribeToAuctionBids(auctions_contract);
        this.setState({operation_subscription: subscription, auctions_contract: auctions_contract}, () => {
            Logging.InfoDev("Registered auction op subscription");
            this.state.operation_subscription?.on('data', this.operationSubscriptionCallback);
        });
    }

    private unregisterAuctionSubscription() {
        this.state.operation_subscription?.off("data", this.operationSubscriptionCallback);
        Logging.InfoDev("Unregistered auction op subscription");
    }

    private operationSubscriptionCallback = (d: OperationContent) => {
        Logging.InfoDev(d);
        const tContent = d as OperationContentsAndResultTransaction;

        // NOTE: might break with internal contract calls!
        if (tContent.parameters) {
            const ep = tContent.parameters.entrypoint;
            if (["bid", "cancel"].includes(ep)) {
                try {
                    const schema = new ParameterSchema(this.state.auctions_contract!.entrypoints.entrypoints[ep])
                    const params = schema.Execute(tContent.parameters.value);

                    // remove the auction from the map, if it's visible!
                    Logging.InfoDev("Removing auction on", ep, params.auction_key.token_id.toNumber(), params.auction_key.fa2, params.auction_key.owner);
                    this.removeFromAuctions(new AuctionKey(params.auction_key.token_id, params.auction_key.fa2, params.auction_key.owner));
                }
                catch (e) {
                    Logging.InfoDev("Failed to parse parameters.");
                    Logging.InfoDev(e);
                }
            }
        }
    }

    private async getSecondaryEnabled() {
        return Promise.all([
            DutchAuction.isSecondaryMarketEnabled(this.context),
            DutchAuction.getWhitelistSettingsForToken(this.context, Conf.place_contract),
            DutchAuction.getWhitelistSettingsForToken(this.context, Conf.interior_contract),
        ]);
    }

    override componentDidMount() {
        this.context.walletEvents().addListener("walletChange", this.walletChangeListener);

        this.getSecondaryEnabled().then(([secondary_enabled, whitelist_settings_places, whitelist_settings_interiors]) => {
            this.setState({
                secondary_enabled: secondary_enabled,
                whitelist_settings_places: whitelist_settings_places,
                whitelist_settings_interiors: whitelist_settings_interiors
            });
        });

        this.registerAuctionSubscription();

        this.walletChangeListener();

        this.reloadAuctions();
    }

    override componentWillUnmount() {
        this.unregisterAuctionSubscription();
        this.context.walletEvents().removeListener("walletChange", this.walletChangeListener);
    }

    override componentDidUpdate() {
        if(this.state.more_data && !scrollbarVisible(document.body)) {
            this.fetchMoreData();
        }
    }

    private removeFromAuctions = (auction_key: AuctionKey) => {
        this.state.auctions.delete(auction_key.toString());
        this.setState({auctions: this.state.auctions});

        this.walletChangeListener();
    }

    private reloadAuctions = () => {
        // TODO: first fetch should probably be by offset 0,
        // but we can also just use a very large id.
        this.getAuctions(10000000).then((res) => {
            const more_data = res.length === Auctions.FetchAmount;
            let last_auction_id = 0;
            const new_auctions = new Map<string, any>();
            for (const r of res) {
                last_auction_id = r.transientId;
                const auction_key = AuctionKey.fromNumber(r.tokenId, r.fa2, r.ownerId);
                if(!isPlaceAllowedToTrade(auction_key)) continue;
                new_auctions.set(auction_key.toString(), r);
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
                    last_auction_id = r.transientId;
                    const auction_key = AuctionKey.fromNumber(r.tokenId, r.fa2, r.ownerId);
                    if(!isPlaceAllowedToTrade(auction_key)) continue;
                    this.state.auctions.set(auction_key.toString(), r);
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
        const event_value: AuctionTypeFilter = event.currentTarget.value;

        Logging.InfoDev(event_checked, event_value);

        this.setState({ type_filter: event_value }, () => { this.reloadAuctions() });
    }

    private whitelistEnabledFor(): string[] {
        const whitelist_enabled_for = [];
        if (this.state.whitelist_settings_places[0] === true)
            whitelist_enabled_for.push("Places");

        if (this.state.whitelist_settings_interiors[0] === true)
            whitelist_enabled_for.push("Interiors");

        return whitelist_enabled_for;
    }

    private isAnyWhitelistsAdmin(): boolean {
        if (!this.context.isWalletConnected()) return false;

        if (this.state.whitelist_settings_places[1] === this.context.walletPHK())
            return true;

        if (this.state.whitelist_settings_interiors[1] === this.context.walletPHK())
            return true;

        return false;
    }

    private isWhitelistedFor(fa2: string) {
        if (fa2 === Conf.place_contract) return !this.state.whitelist_settings_places[0] || this.state.user_is_whitelisted_places;
        if (fa2 === Conf.interior_contract) return !this.state.whitelist_settings_interiors[0] || this.state.user_is_whitelisted_interiors;
        if (fa2 === Conf.place_v1_contract) return false;
        Logging.ErrorDev(`Unknown token type in auction: ${fa2}`);
        return false;
    }

    override render() {
        const rows = [];
        this.state.auctions.forEach((auction) => {
            rows.push(<AuctionCard key={auction.transientId} auctionId={auction.transientId} startPrice={auction.startPrice} endPrice={auction.endPrice} isPrimary={auction.isPrimary}
                startTime={this.parseTimestamp(auction.startTime)} endTime={this.parseTimestamp(auction.endTime)} owner={auction.ownerId} placeKey={new PlaceKey(auction.tokenId, auction.fa2)}
                finished={auction.finished} finishingBid={auction.finishingBid} bidOpHash={auction.bidOpHash}
                userWhitelisted={this.isWhitelistedFor(auction.fa2)} />);
        });

        if(rows.length === 0) {
            rows.push(<div key={0} className='mt-5 mb-5'>It looks like there aren't any active auctions. Check back later :)</div>)
        }

        const whitelist_enabled_for = this.whitelistEnabledFor();

        return (
            <main>
                <Helmet>
                    <title>tz1and - Place Auctions</title>
                </Helmet>
                <div className="position-relative container text-start mt-4">
                    <h1>Place Auctions</h1>
                    <Container className='m-0 p-0'>
                        <Row>
                            <Col md="7">
                                <p>This is the <i>primary</i> (newly minted Places will end up here) and{!this.state.secondary_enabled && " - when it will be enabled -"} also a secondary (everyone can create auctions) marketplace for Places.</p>
                                <p>Listings are price drop (dutch) auctions, the price lowering continually to an end price. Auctions remain active unless cancelled, they can be cancelled by the creator before a bid.</p>
                                <p>Price drops once every 60 seconds. There is a 6% management fee on successful bids.</p>
                                { (whitelist_enabled_for.length > 0) && <p><b>For primary actions for {whitelist_enabled_for.join(", ")}, you currently need to be apply. Join the <a href={Conf.discordInviteLink} target="_blank" rel="noreferrer">Discord</a> to apply for a primary.</b></p> }
                            </Col>
                            <Col md="5">
                                { (this.state.secondary_enabled || this.isAnyWhitelistsAdmin()) && <Link to='/auctions/create' className='position-absolute btn btn-primary top-0 end-0'>Create Auction</Link>}
                                {/*<p className='bg-info rounded px-3 p-2'>Please be aware that the price for <i>primary listings</i> is intended to be below 200tez. It may be worth waiting.</p>*/}
                                <p className='bg-warning rounded px-3 p-2'>Some Item's ownership will transfer with the place - Items that are added as "place owned".</p>
                                { !this.state.secondary_enabled && <p className='bg-info rounded px-3 p-2'>Secondary market is currently <b>disabled</b> because the UI needs some updates to work well with place-owned Items.</p> }
                            </Col>
                        </Row>
                    </Container>

                    <ToggleButtonGroup className='me-2' type='radio' name='auctionStateFilter' defaultValue='active' onChange={(v, e) => this.handleActiveFilter(v, e)}>
                        <ToggleButton id='radioStateActive' type="radio" variant='outline-primary' value='active'>Active</ToggleButton>
                        <ToggleButton id='radioStateFinished' type="radio" variant='outline-primary' value='finished'>Finished</ToggleButton>
                    </ToggleButtonGroup>

                    <ToggleButtonGroup type='radio' name='auctionTypeFilter' defaultValue={defaultAuctionTypeFilter} onChange={(v, e) => this.handleSecondaryFilter(v, e)}>
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
                        scrollThreshold="100px"
                    >
                        {rows}
                    </InfiniteScroll>
                </div>

            </main>
        );
    }
}

export default Auctions;