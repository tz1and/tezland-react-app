import React from 'react';
import './Explore.css';
import VirtualSpace from './VirtualSpace';
import { MintFrom } from '../forms/MintForm';
import { PlaceForm } from '../forms/PlaceForm';
import { Inventory } from '../forms/Inventory';
import { Node, Nullable } from '@babylonjs/core';
import { Instructions } from '../forms/Instructions';
import { ControlsHelp } from './ControlsHelp';
import { SettingsForm } from '../forms/SettingsForm';
import AppSettings from '../storage/AppSettings';
import { Notification, NotificationData } from './Notification';
import Conf from '../Config';
import { PlaceFropertiesForm } from '../forms/PlaceProperties';
import { FromNames } from '../world/AppControlFunctions';

type ExploreProps = {
    // using `interface` is also ok
    //message: string;
};
type ExploreState = {
    show_form: FromNames;
    dispaly_overlay: boolean;
    placedItem: Nullable<Node>;
    showFps: boolean; // should be a prop?
    notifications: NotificationData[];
    placeInfo: {placeId: number, owner: string, ownedOrOperated: boolean};
    groundColor: string;
    //count: number; // like this
};

export default class Explore extends React.Component<ExploreProps, ExploreState> {
    private virtualSpaceRef = React.createRef<VirtualSpace>();

    constructor(props: ExploreProps) {
        super(props);
        this.state = {
            show_form: 'instructions',
            dispaly_overlay: true,
            placedItem: null,
            showFps: AppSettings.showFps.value,
            notifications: [],
            placeInfo: {placeId: 0, owner: '', ownedOrOperated: false},
            groundColor: '#FFFFFF'
            // optional second annotation for better type inference
            //count: 0,
        };
    }

    loadForm = (form_type: FromNames) => {
        this.setState({ show_form: form_type, dispaly_overlay: true });
    }

    setOverlayDispaly = (display: boolean) => {
        // Only set state if the overlay state hasn't changed.
        // Avoids form components being called twice.
        if (this.state.dispaly_overlay !== display)
            this.setState({ dispaly_overlay: display });
    }

    placeItem = (node: Node) => {
        this.setState({ show_form: 'placeitem', dispaly_overlay: true, placedItem: node });
    }

    editPlaceProperties = (groundColor: string) => {
        this.setState({ show_form: 'placeproperties', dispaly_overlay: true, groundColor: groundColor });
    }

    closeForm = (cancelled: boolean) => {
        if(this.state.show_form === 'settings') {
            this.setState({ show_form: 'instructions', dispaly_overlay: true });
            return;
        }

        // remove item if action was cancelled.
        if(cancelled && this.state.placedItem) this.state.placedItem.dispose();

        this.setState({ show_form: 'instructions', dispaly_overlay: false, placedItem: null });

        this.virtualSpaceRef.current?.lockControls();
    }

    selectItemFromInventory = (id: number) => {
        this.setState({ show_form: 'instructions', dispaly_overlay: false });

        const curVS = this.virtualSpaceRef.current;
        if (curVS) {
            curVS.setInventoryItem(id);
            curVS.lockControls();
        }
    }

    addNotification = (data: NotificationData) => {
        this.setState({ notifications: this.state.notifications.concat(data) });

        // warnign: dangling timeout
        setTimeout(() => {
            const newNotifications: NotificationData[] = [];
            for(const p of this.state.notifications) {
                if(p.id !== data.id) newNotifications.push(p);
            }
            this.setState({notifications: newNotifications});
        }, 10000);
    }

    updatePlaceInfo = (placeId: number, owner: string, ownedOrOperated: boolean) => {
        this.setState({placeInfo: {
            placeId: placeId,
            owner: owner,
            ownedOrOperated: ownedOrOperated
        }});
    }

    getCurrentLocation = (): [number, number] => {
        const curVS = this.virtualSpaceRef.current;
        if (curVS) return curVS.getCurrentLocation();
        return [0,0];
    }

    override render() {
        // TODO: maybe could use router for overlay/forms.
        let form;
        if (this.state.show_form === 'instructions') form = <Instructions closeForm={this.closeForm} loadForm={this.loadForm} getCurrentLocation={this.getCurrentLocation} />
        else if (this.state.show_form === 'settings') form = <SettingsForm closeForm={this.closeForm} />;
        else if (this.state.show_form === 'mint') form = <MintFrom closeForm={this.closeForm} />;
        else if (this.state.show_form === 'placeitem') form = <PlaceForm closeForm={this.closeForm} placedItem={this.state.placedItem} />;
        else if (this.state.show_form === 'inventory') form = <Inventory closeForm={this.closeForm} selectItemFromInventory={this.selectItemFromInventory} />;
        else if (this.state.show_form === 'placeproperties') form = <PlaceFropertiesForm closeForm={this.closeForm}
            placeOwner={this.state.placeInfo.owner} placeId={this.state.placeInfo.placeId} groundColor={this.state.groundColor} />;

        let overlay = !this.state.dispaly_overlay ? null :
            <div className="Explore-overlay">
                <div className='my-auto mx-auto'>
                    {form}
                </div>
            </div>

        let controlInfo = this.state.dispaly_overlay ? <ControlsHelp/> : null;

        let placeInfoOverlay = this.state.dispaly_overlay ? null :
            <div className='position-fixed top-0 start-0 bg-white p-3 m-2 rounded-1'>
                <h5>Place #{this.state.placeInfo.placeId}</h5>
                <hr/>
                Owner: {this.state.placeInfo.owner}<br/>
                Permissions: {this.state.placeInfo.ownedOrOperated ? "Yes" : "No"}
            </div>;

        let toasts = this.state.notifications.map((v) => { return <Notification data={v} key={v.id}/> });

        return (
            <div className='Explore'>
                <small className='position-fixed bottom-0 end-0 text-white text-bolder mb-2 me-3' style={{zIndex: "1040"}}>{ "tz1and v" + Conf.app_version}</small>
                {this.state.showFps ? <div id="fps">0</div> : null}
                {overlay}
                {controlInfo}
                {placeInfoOverlay}
                <div className="toast-container position-fixed bottom-0 start-0 p-5 px-4" style={{zIndex: "1050"}}>{toasts}</div>
                <VirtualSpace ref={this.virtualSpaceRef} appControl={{
                    setOverlayDispaly: this.setOverlayDispaly,
                    loadForm: this.loadForm,
                    placeItem: this.placeItem,
                    editPlaceProperties: this.editPlaceProperties,
                    addNotification: this.addNotification,
                    updatePlaceInfo: this.updatePlaceInfo,
                }} />
            </div>
        );
    }
}
