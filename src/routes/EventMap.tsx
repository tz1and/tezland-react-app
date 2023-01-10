import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { MarkerMode } from '../world/map/WorldMap';
import { useParams } from 'react-router-dom';
import { grapphQLUser } from '../graphql/user';
import InteractiveMap from '../components/InteractiveMap';
import assert from 'assert';


const EventMap: React.FC<{}> = () => {
    const params = useParams();

    const [markedPlaces, setMarkedPlaces] = useState<number[]>()

    assert(params.eventTag);
    assert(params.eventLabel);
    const eventTag = params.eventTag;
    const eventLabel = params.eventLabel;

    useEffect(() => {
        if (!markedPlaces) {
            grapphQLUser.getPlacesWithSwapsByTag({tag: eventTag, amount: 100, offset: 0}).then(res => {
                const placeIds: number[] = [];
                for (const p of res.placeToken) {
                    placeIds.push(p.tokenId);
                }

                setMarkedPlaces(placeIds);
            });
        }
    }, [markedPlaces, eventTag])

    return (
        <main>
            <Helmet>
                <title>tz1and - Event Map "{eventLabel}"</title>
            </Helmet>
            <div className="container text-start mt-4">
                <h1>{eventLabel}</h1>
                <h5>Showing all places with items tagged '{eventTag}' for sale.{markedPlaces && markedPlaces.length === 0 && " There's none, at the moment."}</h5>
            </div>

            <div className='container-fluid p-0'>
                <InteractiveMap zoom={500} threeD={true} markerMode={MarkerMode.Places} markedPlaces={markedPlaces} />
            </div>
        </main>
    );
}

export default EventMap;