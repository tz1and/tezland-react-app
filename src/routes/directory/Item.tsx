import React from 'react';
import { Col, Container, Row, Tab, Tabs } from 'react-bootstrap';
import { Link, Params, useParams } from 'react-router-dom';
import assert from 'assert';
import TezosWalletContext from '../../components/TezosWalletContext';
import { truncateAddress } from '../../utils/Utils';
import Metadata from '../../world/Metadata';
import ModelPreview from '../../forms/ModelPreview';
import { fetchGraphQL } from '../../ipfs/graphql';
import { getiFrameControl } from '../../forms/DirectoryForm';
import { WorldHolderInfo } from '../../components/item/WorldHolderInfo';
import { CollectionHistory } from '../../components/item/CollectionHistory';
import { ItemTags } from '../../components/item/ItemTags';

interface UserProps extends WithParamsInterface {
}

type UserState = {
    metadata?: any;
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

            this.fetchRoyalties().then(res => {
                this.setState({royalties: res.royalties});
            });
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
                <Container>
                    <Row>
                        <Col>
                            by <Link to={this.userLink(metadata.minter)}>{truncateAddress(metadata.minter)}</Link>
                            <ModelPreview tokenId={this.tokenId} width={640} height={480} modelLoaded={() => {}} />
                            {/*<img src={this.getThumbnailUrl(metadata.displayUri ? metadata.displayUri : metadata.thumbnailUri)}></img>*/}
                            <h5 className="mt-3">Description:</h5>
                            <p>{metadata.description ? metadata.description : "None."}</p>
                            {royalties}
                        </Col>
                        <Col xs="4" lg="3">
                            <h4>Tags</h4>
                            <ItemTags tokenId={this.tokenId} />
                        </Col>
                    </Row>
                </Container>
                
            </div>;
        }
        
        const activeKey = window.location.hash.replace('#', '') || undefined;

        return (
            <main>
                <div className="position-relative container text-start mt-4">
                    {content}

                    <Tabs defaultActiveKey="holders" activeKey={activeKey!}
                        mountOnEnter={true} unmountOnExit={true}
                        onSelect={(eventKey) => window.location.hash = eventKey || ""}>
                        <Tab eventKey="holders" title="World/Holders">
                            <WorldHolderInfo tokenId={this.tokenId} />
                        </Tab>
                        <Tab eventKey="history" title="History">
                            <CollectionHistory tokenId={this.tokenId} />
                        </Tab>
                    </Tabs>
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