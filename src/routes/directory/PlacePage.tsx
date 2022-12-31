//import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PlaceKey from '../../utils/PlaceKey';
import { Place } from "./Place";


type PlacePageProps = {
    onlyPlaceOwnedItems?: boolean;
};

export const PlacePage: React.FC<PlacePageProps> = (props) => {
    const params = useParams();

    const placeKey = new PlaceKey(parseInt(params.id!), params.fa2!);

    /*const [placeKey, setPlaceKey] = useState<PlaceKey>(new PlaceKey(parseInt(params.id!), params.fa2!));

    // Set tokenId state when prop changes.
    useEffect(() => {
        setPlaceKey(new PlaceKey(parseInt(params.id!), params.fa2!));
    }, [params]);*/

    return (
        <main>
            <Place {...props} placeKey={placeKey}></Place>
        </main>
    );
}