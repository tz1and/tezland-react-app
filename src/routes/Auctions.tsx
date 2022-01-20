import React from 'react';
import { Link } from 'react-router-dom';
import Auction from '../components/Auction'
import { fetchGraphQL } from '../ipfs/graphql';
import { isDev } from '../tz/Utils';

type AuctionsProps = {}

type AuctionsState = {
    auctions: any[]
}

class Auctions extends React.Component<AuctionsProps, AuctionsState> {

    constructor(props: AuctionsProps) {
        super(props);
        this.state = {
            auctions: []
        };
    }

    async getAuctions() {
        const { errors, data } = await fetchGraphQL(`
            query getAuctions {
                dutchAuction(limit: 10, order_by: {id: desc}) {
                    endPrice
                    endTime
                    id
                    ownerId
                    startPrice
                    startTime
                    tokenId
                }
            }`, "getAuctions");
        if(errors) {
            if(isDev()) console.log(errors);
            throw new Error("Query failed");
        }
        return data.dutchAuction;
    }

    componentDidMount() {
        this.reloadAuctions();
    }

    reloadAuctions() {
        this.getAuctions().then((res) => {
            this.setState({ auctions: res });
        });
    }

    private parseTimestamp(t: string): number {
        return Math.floor(Date.parse(t) / 1000);
    }

    render() {
        let reloadAuctionsCallback = this.reloadAuctions.bind(this);

        var rows = [];
        for(const auction of this.state.auctions) {
            rows.push(<Auction key={auction.id} auctionId={auction.id} startPrice={auction.startPrice} endPrice={auction.endPrice}
                startTime={this.parseTimestamp(auction.startTime)} endTime={this.parseTimestamp(auction.endTime)} owner={auction.ownerId} tokenId={auction.tokenId} reloadAuctions={reloadAuctionsCallback} />);
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
                    <div className="d-flex justify-content-left flex-wrap p-2">
                        {rows}
                    </div>
                </div>

            </main>
        );
    }
}

export default Auctions;