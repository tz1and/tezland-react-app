import InteractiveMap from '../components/InteractiveMap';
import { MarkerMode } from '../world/WorldMap';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { grapphQLUser } from '../graphql/user';
import assert from 'assert';


export const EventMap: React.FC<{}> = (props) => {
    const params = useParams();

    const [markedPlaces, setMarkedPlaces] = useState<number[]>()

    assert(params.eventName);
    assert(params.eventLabel);
    const eventName = params.eventName;
    const eventLabel = params.eventLabel;

    useEffect(() => {
        if (!markedPlaces) {
            // TODO: remove metadata from getPlacesWithItemsByTag
            grapphQLUser.getPlacesWithItemsByTag({tag: eventName, amount: 100, offset: 0}).then(res => {
                const placeIds: number[] = [];
                for (const p of res.placeToken) {
                    placeIds.push(p.id);
                }

                setMarkedPlaces(placeIds);
            });
        }
    }, [markedPlaces, eventName])

    return (
        <main>
            <div className="container text-start mt-4">
                <h1>{eventLabel}</h1>
                <h5>All Places participating in this event.{markedPlaces && markedPlaces.length === 0 && " There's none, at the moment."}</h5>
            </div>

            <div className='container-fluid p-0'>
                <InteractiveMap zoom={500} threeD={true} markerMode={MarkerMode.Places} markedPlaces={markedPlaces} />
            </div>
        </main>
    );
}
