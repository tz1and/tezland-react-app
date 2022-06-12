import React from 'react';
import { Link, Params, useParams } from 'react-router-dom';
import TezosWalletContext from '../components/TezosWalletContext';
import { truncateAddress } from '../utils/Utils';
import assert from 'assert';
import Metadata from '../world/Metadata';
import ModelPreview from '../forms/ModelPreview';
import { fetchGraphQL } from '../ipfs/graphql';
import { getiFrameControl } from '../forms/DirectoryForm';

interface UserProps extends WithParamsInterface {
}

type UserState = {
    metadata?: any;
    holderInfo?: any;
    royalties?: any;
}

class Item extends React.Component<UserProps, UserState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;

    private tokenId: number;

    constructor(props: UserProps) {
        super(props);
        this.state = {};

        assert(this.props.params);
        assert(this.props.params.id);
        this.tokenId = parseInt(this.props.params.id)
    }

    private async fetchHolderInfo(): Promise<any> {
        const data = await fetchGraphQL(`
            query getHolderInfo($id: bigint!) {
                itemTokenHolder(where: {tokenId: {_eq: $id}}, order_by: {quantity: desc}) {
                    holderId
                    quantity
                }
            }`, "getHolderInfo", { id: this.tokenId });
        
        return data.itemTokenHolder;
    }

    private async fetchRoyalties(): Promise<any> {
        const data = await fetchGraphQL(`
            query getRoyalties($id: bigint!) {
                itemToken(where: {id: {_eq: $id}}) {
                    royalties
                }
            }`, "getRoyalties", { id: this.tokenId });
        
        return data.itemToken[0];
    }

    private userLink(address: string): string {
        if(getiFrameControl(window))
            return `/directory/u/${address}`;
        else
            return `/u/${address}`;
    }

    override componentDidMount() {
        Metadata.getItemMetadata(this.tokenId).then(res => {
            this.setState({metadata: res});

            this.fetchHolderInfo().then(res => {
                this.setState({holderInfo: res});
            })

            this.fetchRoyalties().then(res => {
                this.setState({royalties: res.royalties});
            })
        })
    }

    override render() {
        const metadata = this.state.metadata;

        let content = undefined;
        if (metadata) {

            let royalties = undefined;
            if (this.state.royalties) {
                royalties = <p>Royalties: {this.state.royalties === 0 ? 0 : (this.state.royalties / 10).toFixed(2)}{"\u0025"}</p>
            }
            
            content = <div>
                <h1>{metadata.name}</h1>
                by <Link to={this.userLink(metadata.minter)}>{truncateAddress(metadata.minter)}</Link>
                <ModelPreview tokenId={this.tokenId} width={640} height={480} modelLoaded={() => {}} />
                {/*<img src={this.getThumbnailUrl(metadata.displayUri ? metadata.displayUri : metadata.thumbnailUri)}></img>*/}
                <h5 className="mt-3">Description:</h5>
                <p>{metadata.description ? metadata.description : "None."}</p>
                {royalties}
            </div>;
        }
        

        const holderInfo = this.state.holderInfo;
        const holderInfoItems: JSX.Element[] = []
        if (holderInfo) holderInfo.forEach((item: any) => holderInfoItems.push(<p key={item.holderId}>{item.quantity}x <Link to={this.userLink(item.holderId)}>{truncateAddress(item.holderId)}</Link></p>))

        return (
            <main>
                <div className="position-relative container text-start mt-4">
                    {content}
                    <h5>Holder Info:</h5>
                    {holderInfoItems}
                </div>
            </main>
        );
    }
}

interface WithParamsInterface {
    params?: Params<string>;
}

// inject usParams with a high order function component.
//https://github.com/remix-run/react-router/issues/8146#issuecomment-947860640
// TODO: move to a helpers module or something
function withParams <P>(Component: React.ComponentType<P>): React.FC<P> {
    return props => <Component {...props} params={useParams()} />;
};

const ItemW = withParams(Item);

export default ItemW;