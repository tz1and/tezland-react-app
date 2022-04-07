import React from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Link } from 'react-router-dom';
import Auction, { discordInviteLink } from '../components/Auction'
import TezosWalletContext from '../components/TezosWalletContext';
import { fetchGraphQL } from '../ipfs/graphql';
import DutchAuction from '../tz/DutchAuction';
import { Logging } from '../utils/Logging';

type AuctionsProps = {}

type AuctionsState = {
    auctions: any[], // TODO use a map. See Inventory.
    auction_offset: number,
    more_data: boolean,
    user_is_whitelisted: boolean,

    // global contract settings
    secondary_enabled: boolean,
    whitelist_enabled: boolean,
    administrator: string
}

class Auctions extends React.Component<AuctionsProps, AuctionsState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;

    constructor(props: AuctionsProps) {
        super(props);
        this.state = {
            auctions: [],
            auction_offset: 0,
            more_data: true,
            user_is_whitelisted: false,

            // defaults from the contract
            secondary_enabled: false,
            whitelist_enabled: true,
            administrator: ""
        };
    }

    private fetchAmount: number = 8;
    private firstFetchDone: boolean = false;

    private async getAuctions(last: number) {
        //query getAuctions($offset: Int!, $amount: Int!) {
        //    dutchAuction(offset: $offset, limit: $amount, order_by: {id: desc}) {
        // Fetch with a less than to make sure we get don't
        // load auctions twice because of new added and offset.
        // TODO: probably quite inefficient. find a way to avoid that. maybe a map? 
        try {   
            const data = await fetchGraphQL(`
                query getAuctions($last: bigint!, $amount: Int!) {
                    dutchAuction(limit: $amount, where: {id: {_lt: $last}}, order_by: {id: desc}) {
                        endPrice
                        endTime
                        id
                        ownerId
                        startPrice
                        startTime
                        tokenId
                    }
                }`, "getAuctions", { amount: this.fetchAmount, last: last });
            
            return data.dutchAuction;
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

    private removeFromAuctions = (auction_id: number) => {
        const newAuctions: any[] = [];
        for(const a of this.state.auctions) {
            if(a.id !== auction_id) newAuctions.push(a);
        }
        this.setState({auctions: newAuctions});

        this.walletChangeListener();
    }

    private reloadAuctions = () => {
        // TODO: first fetch should probably be by offset 0,
        // but we can also just use a very large id.
        this.getAuctions(10000000).then((res) => {
            const more_data = res.length === this.fetchAmount;
            this.setState({
                auctions: res,
                auction_offset: this.fetchAmount,
                more_data: more_data
            });
            this.firstFetchDone = true;
        });
    }

    private fetchMoreData = () => {
        if(this.firstFetchDone) {
            this.getAuctions(this.state.auctions[this.state.auctions.length-1].id).then((res) => {
                const more_data = res.length === this.fetchAmount;
                this.setState({
                    auctions: this.state.auctions.concat(res),
                    auction_offset: this.state.auction_offset + this.fetchAmount,
                    more_data: more_data
                });
            });
        }
    }

    private parseTimestamp(t: string): number {
        return Math.floor(Date.parse(t) / 1000);
    }

    override render() {
        var rows = [];
        for(const auction of this.state.auctions) {
            rows.push(<Auction key={auction.id} auctionId={auction.id} startPrice={auction.startPrice} endPrice={auction.endPrice} isPrimary={auction.ownerId === this.state.administrator}
                startTime={this.parseTimestamp(auction.startTime)} endTime={this.parseTimestamp(auction.endTime)} owner={auction.ownerId} tokenId={auction.tokenId}
                userWhitelisted={this.state.user_is_whitelisted} removeFromAuctions={this.removeFromAuctions} />);
        }

        if(rows.length === 0) {
            rows.push(<div key={0} className='mt-5 mb-5'>It looks like there aren't any active auctions. Check back later :)</div>)
        }

        return (
            <main>
                <div className="position-relative container text-start mt-4">
                    <h1>Active Place Auctions</h1>
                    <p>This is the <i>primary</i> (newly minted Places will end up here) and{!this.state.secondary_enabled && " - when it will be enabled -"} also a secondary (everyone can create auctions) marketplace for Places.</p>
                    <p>All auctions are price drop (dutch) auctions, with the price lowering continually to an end price. Auctions remain active unless cancelled, they can be cancelled by the creator before a bid.</p>
                    <p>Price drops once every 60 seconds. There is a 2.5% management fee on successful bids.</p>
                    { this.state.whitelist_enabled ? <p><b>For primary actions, you need to be whitelisted. Join the <a href={discordInviteLink} target="_blank" rel="noreferrer">Discord</a> to get whitelisted.</b></p> : null }
                    { this.state.secondary_enabled || DutchAuction.isAdministrator(this.context, this.state.administrator) ? <Link to='/auctions/create' className='position-absolute btn btn-primary top-0 end-0'>Create Auction</Link> : null}
                    { this.state.secondary_enabled && <p className='bg-info rounded p-2'>Please be aware that the price for <i>primary listings</i> is intended to be affordable and below 10tez. It may be worth waiting.</p>}
                    <hr/>
                    <InfiniteScroll
                        className="d-flex justify-content-left flex-wrap p-2"
                        dataLength={this.state.auctions.length} //This is important field to render the next data
                        next={this.fetchMoreData}
                        hasMore={this.state.more_data}
                        loader={<h4>Loading...</h4>}
                        scrollThreshold={1}
                    >
                        {rows}
                    </InfiniteScroll>
                </div>

            </main>
        );
    }
}

export default Auctions;