import { useEffect, useState } from 'react';
import Metadata, { PlaceTokenMetadata } from '../../world/Metadata';
import { Button, Col, Container, Row } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { getDirectoryEnabledGlobal, iFrameControlEvent } from '../../forms/DirectoryForm';
import Conf from "../../Config";
import { FetchDataFunc, FetchDataResultArray, ItemClickedFunc, TokenInfiniteScroll } from "../../components/TokenInfiniteScroll";
import { grapphQLUser } from "../../graphql/user";
import TokenKey from "../../utils/TokenKey";
import { DirectoryUtils } from "../../utils/DirectoryUtils";
import { InventoryItem } from "../../components/InventoryItem";
import PlaceKey, { getPlaceType, PlaceType } from "../../utils/PlaceKey";
import WorldLocation from "../../utils/WorldLocation";
import { WorldMap2D } from '../../components/WorldMap2D';


type PlaceProps = {
    onlyPlaceOwnedItems?: boolean;
    detailOverride?: JSX.Element;
    mapSize?: [string, string];
    placeKey: PlaceKey;
    openLinksInNewTab?: boolean | undefined;
};

export const Place: React.FC<PlaceProps> = (props) => {
    const navigate = useNavigate();

    const [metadata, setMetadata] = useState<PlaceTokenMetadata>();
    const [owner, setOwner] = useState<string>();

    const mapSize = props.mapSize ? props.mapSize : ["640px", "480px"];

    useEffect(() => {
        Metadata.getPlaceMetadata(props.placeKey.id, props.placeKey.fa2).then(res => {
            setMetadata(res);
        });
    }, [props.placeKey]);

    useEffect(() => {
        grapphQLUser.getPlaceOwner({id: props.placeKey.id, fa2: props.placeKey.fa2}).then((res) => {
            setOwner(res.placeTokenHolder[0].holderId);
        })
    }, [props.placeKey]);

    const teleportToPlace = () => {
        if(getDirectoryEnabledGlobal()) {
            window.parent.postMessage({
                tz1andEvent: true,
                teleportToLocation: new WorldLocation({placeKey: new PlaceKey(props.placeKey.id, props.placeKey.fa2)})
            } as iFrameControlEvent, "*");
        }
        else
            navigate(`/explore?placekey=${props.placeKey.fa2},${props.placeKey.id}`);
    }

    let name = null;
    let description = "None.";

    // TODO: put this in state maybe?
    let center_pos: [number, number] = [1000, 1000];
    let placePoly: [number, number][] = [];
    let content = undefined;
    if (metadata) {
        name = metadata.name;
        if (metadata.description) description = metadata.description;

        const coords = metadata.centerCoordinates;
        center_pos = [1000 + -coords[2], 1000 + -coords[0]];

        const polygon = metadata.borderCoordinates;
        for(const pos of polygon) {
            placePoly.push([center_pos[0] + -pos[2], center_pos[1] + -pos[0]]);
        }

        const placeType = getPlaceType(props.placeKey.fa2);

        content = <div>
            <h1>{name}</h1>
            <Container>
                <Row className="gx-0">
                    <Col xl="7" lg="12" className="mb-3">
                        <WorldMap2D mapClass='' isExteriorPlace={placeType !== PlaceType.Interior} style={{width: mapSize[0], height: mapSize[1]}} location={center_pos} placePoly={placePoly} zoomControl={true} animate={false} />
                    </Col>
                    <Col xl="5" lg="12">
                        {props.detailOverride ? props.detailOverride : <div>
                            <h5>Description:</h5>
                            <p>{description}</p>
                            {owner && <p>Owner: {DirectoryUtils.userLinkElement(owner, props.openLinksInNewTab)}</p>}
                            {props.openLinksInNewTab ?
                                <Link to={`/explore?placekey=${props.placeKey.fa2},${props.placeKey.id}`} target="_blank">
                                    <Button>Visit Place</Button>
                                </Link> :
                                <Button onClick={teleportToPlace}>Visit Place</Button>}
                        </div>}
                    </Col>
                </Row>
            </Container>
        </div>;
    }

    const fetchInventory: FetchDataFunc = async (dataOffset: number, fetchAmount: number): Promise<FetchDataResultArray> => {
        const res = await grapphQLUser.getItemsInPlace({ fa2: props.placeKey.fa2, id: props.placeKey.id, amount: fetchAmount, offset: dataOffset });
        const results = res.worldItemPlacement;
        
        // format the data to fit the data format the item components expect.
        const formatted: FetchDataResultArray = []
        for (const res of results) {
            if (props.onlyPlaceOwnedItems && res.issuerId !== null) continue;
            formatted.push({key: res.transientId, token: res.itemToken, swapInfo: { amount: res.amount, price: res.rate }});
        }

        return formatted;
    }

    const handleClick: ItemClickedFunc = (token_key: TokenKey, quantity?: number) => {
        // TODO: should link to fa2/tokenid
        navigate(DirectoryUtils.itemLink(token_key));
    }

    /*const handleBurn = (item_id: number) => {
        // TODO: modal version of transfer dialog
        //this.props.burnItemFromInventory(item_id);
    }

    const handleTransfer = (item_id: number) => {
        // TODO: modal version of burn dialog
        //this.props.transferItemFromInventory(item_id);
    }*/

    return (
        <Container className="text-start mt-4">
            {props.placeKey.fa2 === Conf.place_v1_contract && <p className="bg-warning-light rounded p-3">
                You are looking at the deprecated V1 Place token. The new place token is here: {DirectoryUtils.placeLinkElement(new PlaceKey(props.placeKey.id, Conf.place_contract))}</p>}
            {content}
            {props.placeKey.fa2 !== Conf.place_v1_contract && <div className="mt-3">
                {props.onlyPlaceOwnedItems ? <h2>Items owned by this Place</h2> : <h2>Items in this Place</h2>}
                <TokenInfiniteScroll fetchDataFunc={fetchInventory} handleClick={handleClick} fetchAmount={20} component={InventoryItem}/>
            </div>}
        </Container>
    );
}