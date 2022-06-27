import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import assert from 'assert';
import { FetchDataFunc, FetchDataResultArray, GraphQLInfiniteScroll, ItemClickedFunc } from '../components/GraphQLInfiniteScroll';
import { PlaceItem } from '../components/PlaceItem';
import { grapphQLUser } from '../graphql/user';
import { DirectoryUtils } from '../utils/DirectoryUtils';

type UserProps = {}

const Event: React.FC<UserProps> = (props) => {
    const params = useParams();
    const navigate = useNavigate();

    assert(params.eventName);
    assert(params.eventLabel);
    const eventName = params.eventName;
    const eventLabel = params.eventLabel;

    const fetchPlaceData: FetchDataFunc = async (dataOffset: number, fetchAmount: number): Promise<FetchDataResultArray> => {
        const dataPlaceIds = await grapphQLUser.getPlacesWithItemsByTag({tag: eventName, amount: fetchAmount, offset: dataOffset})
        const results = dataPlaceIds.placeToken;

        // format so it fits the result the format the token components expect.
        const formatted: FetchDataResultArray = []
        for (const res of results) {
            formatted.push({token: {id: res.id}});
        }

        return formatted;
    }

    const handleClick: ItemClickedFunc = (item_id: number, quantity?: number) => {
        navigate(DirectoryUtils.placeLink(item_id));
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