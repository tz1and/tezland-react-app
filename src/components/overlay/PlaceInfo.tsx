import { useTzktAlias } from "../../routes/directory/User";
import { getPlaceType } from "../../utils/PlaceKey";
import BasePlaceNode from "../../world/nodes/BasePlaceNode";


type PlaceInfoProps = {
    show: boolean;
    currentPlace: BasePlaceNode | null;
};

export const PlaceInfo: React.FC<PlaceInfoProps> = (props) => {
    //const tzktAccount = useTzktAlias(props.currentPlace ? props.currentPlace.currentOwner : '');

    return (
        (props.show && props.currentPlace) ?
            <div className='position-fixed top-0 start-0 bg-white p-3 m-2 rounded-1'>
                <h5 className='mb-0'>{props.currentPlace.getName()}</h5>
                <small className='text-muted'>{getPlaceType(props.currentPlace.placeKey.fa2)} #{props.currentPlace.placeKey.id}</small>
                <hr/>
                Owner: {props.currentPlace.currentOwner} {/*tzktAccount.getNameDisplay()*/}<br/>
                Permissions: {props.currentPlace.getPermissions.toString()}
            </div> : null
    )
}