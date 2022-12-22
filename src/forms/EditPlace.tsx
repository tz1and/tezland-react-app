import React from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { useTezosWalletContext } from '../components/TezosWalletContext';
import BasePlaceNode from '../world/nodes/BasePlaceNode';
import { PlaceAddPermissionsForm } from './PlaceAddPermissions';
import { PlacePropertiesForm } from './PlaceProperties';
import { PlaceRemovePermissionsForm } from './PlaceRemovePermissions';

type EditPlaceProps = {
    closeForm(): void;
    place: BasePlaceNode;
}

export const EditPlace: React.FC<EditPlaceProps> = (props) => {
    const context = useTezosWalletContext();

    const is_owner = context.walletPHK() === props.place.currentOwner;

    return (
        <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
            <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => props.closeForm()} />
            <h2>edit Place</h2>

            <Tabs defaultActiveKey="properties"
                mountOnEnter={true} unmountOnExit={true}
                onSelect={(eventKey) => window.location.hash = eventKey || ""}>
                <Tab eventKey="properties" title="Properties">
                    <PlacePropertiesForm place={props.place} />
                </Tab>
                { is_owner ? <Tab eventKey="add_permissions" title="Add Permissions">
                    <PlaceAddPermissionsForm place={props.place} />
                </Tab> : null }
                { is_owner ? <Tab eventKey="remove_permissions" title="Remove Permissions">
                    <PlaceRemovePermissionsForm place={props.place} />
                </Tab> : null }
            </Tabs>
        </div>
    );
};
