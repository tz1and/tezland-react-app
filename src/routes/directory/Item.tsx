import React from 'react';
import { Col, Container, Row, Tab, Tabs } from 'react-bootstrap';
import { Params, useParams } from 'react-router-dom';
import assert from 'assert';
import TezosWalletContext from '../../components/TezosWalletContext';
import Metadata from '../../world/Metadata';
import { WorldHolderInfo } from '../../components/item/WorldHolderInfo';
import { CollectionHistory } from '../../components/item/CollectionHistory';
import { ItemTags } from '../../components/item/ItemTags';
import { MetadataUtils } from '../../utils/MetadataUtils';
import { ItemDisplay } from '../../components/item/ItemDisplay';

interface UserProps extends WithParamsInterface {
}

type UserState = {
    metadata?: any;
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

    override componentDidMount() {
        Metadata.getItemMetadata(this.tokenId).then(res => {
            this.setState({metadata: res});
        })
    }

    override render() {
        const metadata = this.state.metadata;

        let content =
            <div>
                <h1>{MetadataUtils.getName(metadata)}</h1>
                <Container className="p-0">
                    <Row>
                        <Col>
                            <ItemDisplay tokenId={this.tokenId} metadata={this.state.metadata} displayModel={true} />
                        </Col>
                        <Col xs="4" lg="3">
                            <h4>Tags</h4>
                            <ItemTags tokenId={this.tokenId} clickable={true} />
                        </Col>
                    </Row>
                </Container>
            </div>;
        
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