import React, { useEffect, useState } from 'react';
import { useTezosWalletContext } from '../components/TezosWalletContext';
import Metadata, { ItemTokenMetadata } from '../world/Metadata';
import { MetadataUtils } from '../utils/MetadataUtils';
import { Button, Container, Row, Col } from 'react-bootstrap';
import Contracts from '../tz/Contracts';
import { ItemTags } from '../components/item/ItemTags';
import { WorldHolderInfo } from '../components/item/WorldHolderInfo';
import { ItemDisplay } from '../components/item/ItemDisplay';
import { Logging } from '../utils/Logging';
import { PlaceKey } from '../world/nodes/BasePlaceNode';
import TokenKey from '../utils/TokenKey';


type CollectFormProps = {
    closeForm(): void;
    tokenKey: TokenKey;
    placeKey: PlaceKey;
    chunkId: number;
    itemId: number;
    issuer: string | null;
    xtzPerItem: number;
}

export const CollectForm: React.FC<CollectFormProps> = (props) => {
    const context = useTezosWalletContext();

    const [metadata, setMetadata] = useState<ItemTokenMetadata>();

    useEffect(() => {
        Metadata.getItemMetadata(props.tokenKey.id.toNumber(), props.tokenKey.fa2).then(res => {
            setMetadata(res);
        })
    }, [props]);

    const collectItem = () => {
        Contracts.getItem(context, props.placeKey, props.chunkId, props.itemId, props.tokenKey.fa2, props.issuer, props.xtzPerItem).then(() => {
            props.closeForm();
        }).catch((e) => { Logging.Error(e); });
    }

    return (
        <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
            <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => props.closeForm()} />

            <div>
                <h1>{MetadataUtils.getName(metadata)}</h1>
                <Container className="p-0">
                    <Row>
                        <Col xs="6" className='pe-3' style={{minWidth: "350px", maxWidth: "400px"}}>
                            {metadata && <ItemDisplay tokenKey={props.tokenKey} metadata={metadata} targetBlank={true} />}
                        </Col>
                        <Col xs="6" className='ps-3' style={{minWidth: "350px", maxWidth: "400px"}}>
                            <h4>Tags</h4>
                            <ItemTags tokenKey={props.tokenKey} clickable={true} targetBlank={true} />

                            <hr />
                            <h4>Listings</h4>
                            <div className='text-nowrap'>
                                <WorldHolderInfo tokenKey={props.tokenKey} onlySwaps={true} targetBlank={true} />
                            </div>
                        </Col>
                    </Row>
                </Container>

                {props.xtzPerItem > 0 ?
                    <><Button onClick={collectItem}>{`Collect for ${props.xtzPerItem} \uA729`}</Button> from Place #{props.placeKey.id}</> :
                    <><Button disabled>Not collectible</Button></>}
            </div>
        </div>
    );
};
