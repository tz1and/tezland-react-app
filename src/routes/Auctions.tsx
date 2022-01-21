import React from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Link } from 'react-router-dom';
import Auction from '../components/Auction'
import { fetchGraphQL } from '../ipfs/graphql';

type AuctionsProps = {}

type AuctionsState = {
    auctions: any[],
    auction_offset: number,
    more_data: boolean
}

// TODO: when new auction was added, it might add elements with duplicate keys.
// find a way to avoid that. maybe a map?
// With a map I can also remove an item in reloadAuctions

class Auctions extends React.Component<AuctionsProps, AuctionsState> {

    constructor(props: AuctionsProps) {
        super(props);
        this.state = {
            auctions: [],
            auction_offset: 0,
            more_data: true
        };
    }

    private fetchAmount: number = 8;
    private firstFetchDone: boolean = false;

    private async getAuctions(offset: number) {
        const data = await fetchGraphQL(`
            query getAuctions($offset: Int!, $amount: Int!) {
                dutchAuction(offset: $offset, limit: $amount, order_by: {id: desc}) {
                    endPrice
                    endTime
                    id
                    ownerId
                    startPrice
                    startTime
                    tokenId
                }
            }`, "getAuctions", { amount: this.fetchAmount, offset: offset });
        
        return data.dutchAuction;
    }

    componentDidMount() {
        this.reloadAuctions();
    }

    private reloadAuctions = () => {
        this.getAuctions(0).then((res) => {
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
            this.getAuctions(this.state.auction_offset).then((res) => {
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

    render() {
        var rows = [];
        for(const auction of this.state.auctions) {
            rows.push(<Auction key={auction.id} auctionId={auction.id} startPrice={auction.startPrice} endPrice={auction.endPrice}
                startTime={this.parseTimestamp(auction.startTime)} endTime={this.parseTimestamp(auction.endTime)} owner={auction.ownerId} tokenId={auction.tokenId} reloadAuctions={this.reloadAuctions} />);
        }

        if(rows.length === 0) {
            rows.push(<div key={0} className='mt-5 mb-5'>It looks like there aren't any active auctions. Check back later :)</div>)
        }

        return (
            <main>
                <div className="container text-start pt-4">
                    <h1>Active Land Auctions</h1>
                    <p>All auctions are price drop (dutch) auctions, with the price lowering continually to an end price.<br/>Auctions can be cancelled by the creator before it's bought.</p>
                    <p>Price drops once every 60 seconds.</p>
                    <Link to='/auctions/create' className='btn btn-primary'>Create Auction</Link>
                    <hr/>
                    <InfiniteScroll
                        className="d-flex justify-content-left flex-wrap p-2"
                        dataLength={this.state.auctions.length} //This is important field to render the next data
                        next={this.fetchMoreData}
                        hasMore={this.state.more_data}
                        loader={<h4>Loading...</h4>}
                        scrollThreshold={1}
                        endMessage={
                            <div className="d-flex justify-content-left flex-wrap p-2">
                                That's all of them.
                            </div>
                        }
                    >
                        {rows}
                    </InfiniteScroll>
                </div>

            </main>
        );
    }
}

export default Auctions;