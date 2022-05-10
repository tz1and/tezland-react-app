import React from 'react';
import { useTezosWalletContext } from '../components/TezosWalletContext';
import PlaceNode from '../world/PlaceNode';
import { PlaceAddPermissionsForm } from './PlaceAddPermissions';
import { PlacePropertiesForm } from './PlaceProperties';
import { PlaceRemovePermissionsForm } from './PlaceRemovePermissions';

type EditPlaceProps = {
    closeForm(cancelled: boolean): void;
    place: PlaceNode;
}

export const EditPlace: React.FC<EditPlaceProps> = (props) => {
    const context = useTezosWalletContext();

    const is_owner = context.walletPHK() === props.place.currentOwner;

    return (
        <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
            <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => props.closeForm(true)} />
            <h2>edit Place</h2>
            <ul className="nav nav-tabs mb-2" id="myTab" role="tablist">
                <li className="nav-item" role="presentation">
                    <button className="nav-link active" id="properties-tab" data-bs-toggle="tab" data-bs-target="#properties" type="button" role="tab" aria-controls="properties" aria-selected="true">Properties</button>
                </li>
                { is_owner ? <li className="nav-item" role="presentation">
                    <button className="nav-link" id="add-permissions-tab" data-bs-toggle="tab" data-bs-target="#add-permissions" type="button" role="tab" aria-controls="add-permissions" aria-selected="false">Add Permissions</button>
                </li> : null }
                { is_owner ? <li className="nav-item" role="presentation">
                    <button className="nav-link" id="remove-permissions-tab" data-bs-toggle="tab" data-bs-target="#remove-permissions" type="button" role="tab" aria-controls="remove-permissions" aria-selected="false">Remove Permissions</button>
                </li> : null }
            </ul>
            <div className="tab-content" id="myTabContent">
                <div className="tab-pane fade show active" id="properties" role="tabpanel" aria-labelledby="properties-tab">
                    <PlacePropertiesForm place={props.place} />
                </div>
                { is_owner ? <div className="tab-pane fade" id="add-permissions" role="tabpanel" aria-labelledby="add-permissions-tab">
                    <PlaceAddPermissionsForm place={props.place} />
                </div> : null }
                { is_owner ? <div className="tab-pane fade" id="remove-permissions" role="tabpanel" aria-labelledby="remove-permissions-tab">
                    <PlaceRemovePermissionsForm place={props.place} />
                </div> : null }
            </div>
        </div>
    );
};
