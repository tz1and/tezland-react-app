import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import assert from 'assert';
import { GraphQLInfiniteScroll } from '../components/GraphQLInfiniteScroll';
import { fetchGraphQL } from '../ipfs/graphql';
import { PlaceItem } from '../components/PlaceItem';
import { Logging } from '../utils/Logging';
import { getiFrameControl } from '../forms/DirectoryForm';

type UserProps = {}

const Event: React.FC<UserProps> = (props) => {
    const params = useParams();
    const navigate = useNavigate();

    assert(params.eventName);
    assert(params.eventLabel);
    const eventName = params.eventName;
    const eventLabel = params.eventLabel;

    const fetchPlaceData = async (dataOffset: number, fetchAmount: number): Promise<any> => {
        const eventView = `placesEvent${eventName}`

        const dataPlaceIds = await fetchGraphQL(`
            query getEventPlaces($offset: Int!, $amount: Int!) {
                ${eventView}(limit: $amount, offset: $offset, order_by: {id: asc}) {
                    id
                }
            }`, "getEventPlaces", { amount: fetchAmount, offset: dataOffset });
        
        const results = dataPlaceIds[eventView];

        const formatted: any[] = []
        for (const res of results) {
            formatted.push({token: {id: res.id}, canVisit: true});
        }

        return formatted;
    }

    const handleClick = (item_id: number, quantity: number) => {
        const iframeControl = getiFrameControl(window);

        if(iframeControl) {
            iframeControl.teleportToLocation("place" + item_id);
            iframeControl.closeForm(false);
        }
        else
            navigate(`/explore?place_id=${item_id}`);
    }

    return (
        <main>
            <div className="position-relative container text-start mt-4">
                <h1>{eventLabel}</h1>
                <h5>All Places participating in this event</h5>

                <GraphQLInfiniteScroll fetchDataFunc={fetchPlaceData} handleClick={handleClick} fetchAmount={20} component={PlaceItem}/>
            </div>
        </main>
    );
}

export default Event;