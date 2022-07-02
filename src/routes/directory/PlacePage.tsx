import map from '../../img/map.svg';
import L from 'leaflet';
import { Circle, ImageOverlay, MapContainer, Polygon } from 'react-leaflet';
import { useEffect, useState } from 'react';
import Metadata from '../../world/Metadata';
import { MapSetCenter } from '../../forms/CreateAuction';
import { Button, Col, Container, Row } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import assert from 'assert';
import { getDirectoryEnabledGlobal, iFrameControlEvent } from '../../forms/DirectoryForm';

type PlacePageProps = { };

export const PlacePage: React.FC<PlacePageProps> = (props) => {
    const navigate = useNavigate();
    const params = useParams();

    assert(params.id);
    const tokenId = parseInt(params.id);

    const [metadata, setMetadata] = useState<any>();

    useEffect(() => {
        if(!metadata)
            Metadata.getPlaceMetadata(tokenId).then((res) => {
                setMetadata(res)
            });
    }, [metadata, tokenId]);

    const teleportToPlace = () => {
        if(getDirectoryEnabledGlobal()) {
            window.parent.postMessage({
                tz1andEvent: true,
                teleportToLocation: "place" + tokenId
            } as iFrameControlEvent, "*");
        }
        else
            navigate(`/explore?placeid=${tokenId}`);
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
                <Row>
                    <Col>
                        <MapContainer style={{width: "640px", height: "480px"}} center={center_pos} zoom={2} minZoom={-2} maxZoom={2} attributionControl={false} dragging={false} zoomControl={true} scrollWheelZoom={false} crs={L.CRS.Simple}>
                            <MapSetCenter center={center_pos} animate={false}/>
                            <ImageOverlay bounds={[[0, 0], [2000, 2000]]} url={map} />
                            <Circle center={center_pos} radius={1.5} color='#d58195' fillColor='#d58195' fill={true} fillOpacity={1} />
                            <Polygon positions={placePoly} color='#d58195' weight={10} lineCap='square'/>
                        </MapContainer>

                        <h5 className="mt-3">Description:</h5>
                        <p>{description}</p>
                    </Col>
                    <Col xs="4" lg="3">
                        <Button onClick={teleportToPlace}>Visit Place</Button>
                    </Col>
                </Row>
            </Container>
        </div>;
    }

    return (
        <main>
            <div className="position-relative container text-start mt-4">
                {content}
            </div>
        </main>
        
    );
}