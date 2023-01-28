import React, { useEffect, useState } from 'react';
import { Col, Container, Row, Tab, Tabs } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import Metadata, { ItemTokenMetadata } from '../../world/Metadata';
import { WorldHolderInfo } from '../../components/item/WorldHolderInfo';
import { CollectionHistory } from '../../components/item/CollectionHistory';
import { ItemTags } from '../../components/item/ItemTags';
import { MetadataUtils } from '../../utils/MetadataUtils';
import { ItemDisplay } from '../../components/item/ItemDisplay';
import TokenKey from '../../utils/TokenKey';
import TokenBlacklist from '../../utils/TokenBlacklist';


const Item: React.FC<{}> = (props) => {
    const params = useParams();

    const [tokenKey, setTokenKey] = useState<TokenKey>(TokenKey.fromNumber(parseInt(params.id!), params.fa2!));
    const [metadata, setMetadata] = useState<ItemTokenMetadata>();

    const [moderated] = useState(TokenBlacklist.has(tokenKey.toString()));

    // Set tokenId state when prop changes.
    useEffect(() => {
        const newTokenKey = TokenKey.fromNumber(parseInt(params.id!), params.fa2!);
        if(!newTokenKey.equals(tokenKey)) setTokenKey(newTokenKey);
    }, [params.id, params.fa2]);

    useEffect(() => {
        if(moderated) return;
        Metadata.getItemMetadata(tokenKey.id.toNumber(), tokenKey.fa2).then(res => {
            setMetadata(res);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenKey, moderated]);

    let content =
        <div>
            <h1>{MetadataUtils.getName(metadata)}</h1>
            <Container className="p-0">
                <Row>
                    <Col>
                        {metadata && <ItemDisplay tokenKey={tokenKey} metadata={metadata} displayModel={true} />}
                    </Col>
                    <Col xs="4" lg="3">
                        <h4>Tags</h4>
                        <ItemTags tokenKey={tokenKey} clickable={true} />
                    </Col>
                </Row>
            </Container>
        </div>;
    
    const activeKey = window.location.hash.replace('#', '') || undefined;

    return (
        <main>
            <div className="position-relative container text-start mt-4">
                {moderated && <p className="bg-danger-light rounded p-3">
                    This item has been flagged to be in violation of the rules.</p>}
                {!moderated && <div>
                    {content}

                    <Tabs defaultActiveKey="holders" activeKey={activeKey!}
                        mountOnEnter={true} unmountOnExit={true}
                        onSelect={(eventKey) => window.location.hash = eventKey || ""}>
                        <Tab eventKey="holders" title="World/Holders">
                            <WorldHolderInfo tokenKey={tokenKey} />
                        </Tab>
                        <Tab eventKey="history" title="History">
                            <CollectionHistory tokenKey={tokenKey} />
                        </Tab>
                    </Tabs>
                </div>}
            </div>
        </main>
    );
}

export default Item;