// eslint-disable-next-line import/no-webpack-loader-syntax
import map from "!file-loader!../../img/map.svg"; // Temp workaround for CRA5
import L from 'leaflet';
import { Circle, ImageOverlay, MapContainer, Polygon } from 'react-leaflet';
import { useEffect, useState } from 'react';
import Metadata, { PlaceTokenMetadata } from '../../world/Metadata';
import { MapSetCenter } from '../../forms/CreateAuction';
import { Button, Col, Container, Row } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { getDirectoryEnabledGlobal, iFrameControlEvent } from '../../forms/DirectoryForm';
import { PlaceKey } from "../../world/nodes/BasePlaceNode";
import Conf from "../../Config";
import { FetchDataFunc, FetchDataResultArray, ItemClickedFunc, TokenInfiniteScroll } from "../../components/TokenInfiniteScroll";
import { grapphQLUser } from "../../graphql/user";
import TokenKey from "../../utils/TokenKey";
import { DirectoryUtils } from "../../utils/DirectoryUtils";
import { InventoryItem } from "../../components/InventoryItem";


type PlacePageProps = {
    onlyPlaceOwnedItems?: boolean;
};

export const PlacePage: React.FC<PlacePageProps> = (props) => {
    const navigate = useNavigate();
    const params = useParams();

    const [placeKey, setPlaceKey] = useState<PlaceKey>({id: parseInt(params.id!), fa2: Conf.place_contract});
    const [metadata, setMetadata] = useState<PlaceTokenMetadata>();

    // Set tokenId state when prop changes.
    useEffect(() => {
        setPlaceKey({id: parseInt(params.id!), fa2: Conf.place_contract});
    }, [params.id]);

    useEffect(() => {
        Metadata.getPlaceMetadata(placeKey.id, placeKey.fa2).then(res => {
            setMetadata(res);
        });
    }, [placeKey]);

    const teleportToPlace = () => {
        if(getDirectoryEnabledGlobal()) {
            window.parent.postMessage({
                tz1andEvent: true,
                teleportToLocation: "place" + placeKey.id
            } as iFrameControlEvent, "*");
        }
        else
            navigate(`/explore?placeid=${placeKey.id}`);
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
        
        content = <div>
            <h1>{name}</h1>
            <Container>
                <Row className="gx-0">
                    <Col>
                        <MapContainer style={{width: "640px", height: "480px"}} center={center_pos} zoom={2} minZoom={-2} maxZoom={2} attributionControl={false} dragging={false} zoomControl={true} scrollWheelZoom={false} crs={L.CRS.Simple}>
                            <MapSetCenter center={center_pos} animate={false}/>
                            <ImageOverlay bounds={[[0, 0], [2000, 2000]]} url={map} />
                            <Circle center={center_pos} radius={1.5} color='#d58195' fillColor='#d58195' fill={true} fillOpacity={1} />
                            <Polygon positions={placePoly} color='#d58195' weight={10} lineCap='square'/>
                        </MapContainer>
                    </Col>
                    <Col md="5">
                        <h5>Description:</h5>
                        <p>{description}</p>
                        <Button onClick={teleportToPlace}>Visit Place</Button>
                    </Col>
                </Row>
            </Container>
        </div>;
    }

    const fetchInventory: FetchDataFunc = async (dataOffset: number, fetchAmount: number): Promise<FetchDataResultArray> => {
        const res = await grapphQLUser.getItemsInPlace({ fa2: placeKey.fa2, id: placeKey.id, amount: fetchAmount, offset: dataOffset });
        const results = res.worldItemPlacement;
        
        // format the data to fit the data format the item components expect.
        const formatted: FetchDataResultArray = []
        for (const res of results) {
            if (props.onlyPlaceOwnedItems && res.issuerId === null) continue;
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
        <main>
            <Container className="position-relative text-start mt-4">
                {content}
                <div className="mt-3">
                    {props.onlyPlaceOwnedItems ? <h2>Items owned by this Place</h2> : <h2>Items in this Place</h2>}
                    <TokenInfiniteScroll fetchDataFunc={fetchInventory} handleClick={handleClick} fetchAmount={20} component={InventoryItem}/>
                </div>
            </Container>
        </main>
        
    );
}