import React, { useEffect, useState } from 'react';
import { Col, Container, Row, Tab, Tabs } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import Metadata, { ItemTokenMetadata } from '../../world/Metadata';
import { WorldHolderInfo } from '../../components/item/WorldHolderInfo';
import { CollectionHistory } from '../../components/item/CollectionHistory';
import { ItemTags } from '../../components/item/ItemTags';
import { MetadataUtils } from '../../utils/MetadataUtils';
import { ItemDisplay } from '../../components/item/ItemDisplay';


const Item: React.FC<{}> = (props) => {
    const params = useParams();

    const [tokenId, setTokenId] = useState(parseInt(params.id!));
    const [metadata, setMetadata] = useState<ItemTokenMetadata>();

    // Set tokenId state when prop changes.
    useEffect(() => {
        setTokenId(parseInt(params.id!));
    }, [params.id]);

    useEffect(() => {
        Metadata.getItemMetadata(tokenId).then(res => {
            setMetadata(res);
        });
    }, [tokenId]);

    let content =
        <div>
            <h1>{MetadataUtils.getName(metadata)}</h1>
            <Container className="p-0">
                <Row>
                    <Col>
                        {metadata && <ItemDisplay tokenId={tokenId} metadata={metadata} displayModel={true} />}
                    </Col>
                    <Col xs="4" lg="3">
                        <h4>Tags</h4>
                        <ItemTags tokenId={tokenId} clickable={true} />
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
                        <WorldHolderInfo tokenId={tokenId} />
                    </Tab>
                    <Tab eventKey="history" title="History">
                        <CollectionHistory tokenId={tokenId} />
                    </Tab>
                </Tabs>
            </div>
        </main>
    );
}

export default Item;