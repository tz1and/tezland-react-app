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


type CollectFormProps = {
    closeForm(): void;
    tokenId: number;
    placeId: number;
    itemId: number;
    issuer: string;
    xtzPerItem: number;
}

export const CollectForm: React.FC<CollectFormProps> = (props) => {
    const context = useTezosWalletContext();

    const [metadata, setMetadata] = useState<ItemTokenMetadata>();

    useEffect(() => {
        Metadata.getItemMetadata(props.tokenId).then(res => {
            setMetadata(res);
        })
    }, [props]);

    const collectItem = () => {
        Contracts.getItem(context, props.placeId, props.itemId, props.issuer, props.xtzPerItem).then(() => {
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
                            {metadata && <ItemDisplay tokenId={props.tokenId} metadata={metadata} targetBlank={true} />}
                        </Col>
                        <Col xs="6" className='ps-3' style={{minWidth: "350px", maxWidth: "400px"}}>
                            <h4>Tags</h4>
                            <ItemTags tokenId={props.tokenId} clickable={true} targetBlank={true} />

                            <hr />
                            <h4>Listings</h4>
                            <div className='text-nowrap'>
                                <WorldHolderInfo tokenId={props.tokenId} onlySwaps={true} targetBlank={true} />
                            </div>
                        </Col>
                    </Row>
                </Container>

                {props.xtzPerItem > 0 ?
                    <><Button onClick={collectItem}>{`Collect for ${props.xtzPerItem} \uA729`}</Button> from Place #{props.placeId}</> :
                    <><Button disabled>Not collectible</Button></>}
            </div>
        </div>
    );
};
