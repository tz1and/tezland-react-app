import React, { useEffect, useState } from 'react';
//import { useTezosWalletContext } from './TezosWalletContext';
import { InventoryItem } from '../../components/InventoryItem';
import { useNavigate, useParams } from 'react-router-dom';
import { DirectoryUtils } from '../../utils/DirectoryUtils';
import { FetchDataFunc, FetchDataResultArray, TokenInfiniteScroll, ItemClickedFunc } from '../../components/TokenInfiniteScroll';
import { grapphQLUser } from '../../graphql/user';
import TokenKey from '../../utils/TokenKey';
import { GetCollectionContractQuery } from '../../graphql/generated/user';
import { Col, Container, Row } from 'react-bootstrap';
import { CollectionTags } from '../../components/collection/ContractTags';


type CollectionProps = { };

export const Collection: React.FC<CollectionProps> = (props) => {
    //const walletContext = useTezosWalletContext();
    const navigate = useNavigate();
    const params = useParams();

    const [contractQueryRes, setContractQueryRes] = useState<GetCollectionContractQuery>();

    useEffect(() => {
        grapphQLUser.getCollectionContract({fa2: params.fa2!}).then(res => {
            setContractQueryRes(res);
        });
    }, [params]);

    const fetchNewMints: FetchDataFunc = async (dataOffset: number, fetchAmount: number): Promise<FetchDataResultArray> => {
        const res = await grapphQLUser.getCollectionItems({ fa2: params.fa2!, amount: fetchAmount, offset: dataOffset });

        const results = res.itemToken;
        
        // format the data to fit the data format the item components expect.
        const formatted: FetchDataResultArray = []
        for (const res of results) {
            formatted.push({token: res});
        }

        return formatted;
    }

    const handleClick: ItemClickedFunc = (token_key: TokenKey, quantity?: number) => {
        // TODO: should link to fa2/tokenid
        navigate(DirectoryUtils.itemLink(token_key));
    }

    /*const handleBurn: ItemClickedFunc = (item_id: number, quantity?: number) => {
        // TODO: modal version of transfer dialog
        //this.props.burnItemFromInventory(item_id, quantity);
    }

    const handleTransfer: ItemClickedFunc = (item_id: number, quantity?: number) => {
        // TODO: modal version of burn dialog
        //this.props.transferItemFromInventory(item_id, quantity);
    }*/

    const contractDetails = contractQueryRes && contractQueryRes.tokenContract.length > 0 ? contractQueryRes.tokenContract[0] : undefined;

    return (
        <main>
            <div className="position-relative container text-start mt-4">
                <Container>
                    <Row className='gx-0 gy-0'>
                        <Col>
                            {contractDetails ? <div>
                                <h1>{contractDetails.metadata!.name}</h1>
                                <p>Contract: {DirectoryUtils.tzktAccountLinkElement(params.fa2!)} {contractDetails.ownerId && <span>- Owner: {DirectoryUtils.tzktAccountLinkElement(contractDetails.ownerId)}</span>}</p>
                                <h3>Description</h3>
                                <p style={{whiteSpace: "pre"}}>{contractDetails.metadata!.userDescription ? contractDetails.metadata!.userDescription : contractDetails.metadata!.description}</p>
                            </div> : <h1>Collection</h1>}
                        </Col>
                        <Col>
                            <CollectionTags address={params.fa2!} clickable={false} />
                        </Col>
                    </Row>
                </Container>
                
                <TokenInfiniteScroll fetchDataFunc={fetchNewMints} handleClick={handleClick} fetchAmount={20} component={InventoryItem}/>
            </div>
        </main>
    );
}
