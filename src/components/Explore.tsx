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
import AppSettings, { AppTerms } from '../storage/AppSettings';
import { Notification, NotificationData } from './Notification';
import Conf from '../Config';
import { EditPlace } from '../forms/EditPlace';
import { FormNames } from '../world/AppControlFunctions';
import { LoadingError } from './LoadingError';
import { PlacePermissions } from '../world/Place';
import { isDev } from '../utils/Utils';
import { TermsForm } from '../forms/Terms';
import { BurnForm } from '../forms/BurnForm';
import { TransferForm } from '../forms/TransferForm';

type ExploreProps = {
    // using `interface` is also ok
    //message: string;
};
type ExploreState = {
    show_form: FormNames;
    dispaly_overlay: boolean;
    placedItem: Nullable<Node>;
    showFps: boolean; // should be a prop?
    notifications: NotificationData[]; // TODO: should probably we a map from id to notification.
    placeInfo: {placeId: number, owner: string, permissions: PlacePermissions};
    groundColor: string;
    burnItemId: number;
    transferItemId: number;
    //count: number; // like this
};

export default class Explore extends React.Component<ExploreProps, ExploreState> {
    private virtualSpaceRef = React.createRef<VirtualSpace>();

    constructor(props: ExploreProps) {
        super(props);
        this.state = {
            show_form: AppTerms.termsAccepted.value ? 'instructions' : 'terms',
            dispaly_overlay: true,
            placedItem: null,
            showFps: AppSettings.showFps.value,
            notifications: [],
            placeInfo: {placeId: -1, owner: '', permissions: new PlacePermissions(PlacePermissions.permissionNone)},
            groundColor: '#FFFFFF',
            burnItemId: -1,
            transferItemId: -1
            // optional second annotation for better type inference
            //count: 0,
        };
    }

    loadForm = (form_type: FormNames) => {
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
        if(this.state.show_form === 'settings' || this.state.show_form === 'terms') {
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

    burnItemFromInventory = (id: number) => {
        this.setState({ show_form: 'burn', dispaly_overlay: true, burnItemId: id });
    }

    transferItemFromInventory = (id: number) => {
        this.setState({ show_form: 'transfer', dispaly_overlay: true, transferItemId: id });
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

    updatePlaceInfo = (placeId: number, owner: string, permissions: PlacePermissions) => {
        this.setState({placeInfo: {
            placeId: placeId,
            owner: owner,
            permissions: permissions
        }});
    }

    getCurrentLocation = (): [number, number, number] => {
        const curVS = this.virtualSpaceRef.current;
        if (curVS) return curVS.getCurrentLocation();
        return [0, 0, 0];
    }

    teleportToLocation = (location: string): void => {
        const curVS = this.virtualSpaceRef.current;
        if (curVS) curVS.teleportToLocation(location);
    };

    override componentDidMount() {
        // check if the virtual world failed to load for some reason.
        // TODO: the way the loading errors are handled is kinda nasty. Improve!
        if(this.virtualSpaceRef.current?.failedToLoad) {
            this.setState({show_form: 'loadingerror', dispaly_overlay: true});
        }
    }

    override render() {
        // NOTE: maybe could use router for overlay/forms.
        if(this.state.show_form === 'loadingerror') return <LoadingError/>;

        let form;
        if (this.state.show_form === 'instructions') form = <Instructions closeForm={this.closeForm} loadForm={this.loadForm} getCurrentLocation={this.getCurrentLocation} teleportToLocation={this.teleportToLocation} />
        else if (this.state.show_form === 'terms') form = <TermsForm closeForm={this.closeForm} />;
        else if (this.state.show_form === 'settings') form = <SettingsForm closeForm={this.closeForm} />;
        else if (this.state.show_form === 'mint') form = <MintFrom closeForm={this.closeForm} />;
        else if (this.state.show_form === 'placeitem') form = <PlaceForm closeForm={this.closeForm} placedItem={this.state.placedItem} />;
        else if (this.state.show_form === 'inventory') form = <Inventory closeForm={this.closeForm}
            selectItemFromInventory={this.selectItemFromInventory}
            burnItemFromInventory={this.burnItemFromInventory}
            transferItemFromInventory={this.transferItemFromInventory} />;
        else if (this.state.show_form === 'burn') form = <BurnForm closeForm={this.closeForm} itemId={this.state.burnItemId} />;
        else if (this.state.show_form === 'transfer') form = <TransferForm closeForm={this.closeForm} itemId={this.state.transferItemId} />;
        else if (this.state.show_form === 'placeproperties') form = <EditPlace closeForm={this.closeForm}
            placeOwner={this.state.placeInfo.owner} placeId={this.state.placeInfo.placeId} groundColor={this.state.groundColor} />;

        let overlay = !this.state.dispaly_overlay ? null :
            <div className="Explore-overlay">
                <div className='my-auto mx-auto'>
                    {form}
                </div>
            </div>

        let controlInfo = this.state.dispaly_overlay ? <ControlsHelp/> : null;

        let placeInfoOverlay = !this.state.dispaly_overlay && this.state.placeInfo.placeId !== -1 ?
            <div className='position-fixed top-0 start-0 bg-white p-3 m-2 rounded-1'>
                <h5>Place #{this.state.placeInfo.placeId}</h5>
                <hr/>
                Owner: {this.state.placeInfo.owner}<br/>
                Permissions: {this.state.placeInfo.permissions.toString()}
            </div> : null;

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
                { isDev() ? <div id="inspector-host" /> : null }
            </div>
        );
    }
}
