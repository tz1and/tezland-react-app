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

type ExploreProps = {
    // using `interface` is also ok
    //message: string;
};
type ExploreState = {
    show_form: string;
    dispaly_overlay: boolean;
    placedItem: Nullable<Node>;
    showFps: boolean; // should be a prop?
    notifications: NotificationData[];
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
            showFps: AppSettings.getShowFps(),
            notifications: []
            // optional second annotation for better type inference
            //count: 0,
        };
    }

    loadForm = (form_type: string) => {
        this.setState({ show_form: form_type, dispaly_overlay: true });
    }

    setOverlayDispaly = (display: boolean) => {
        // Only set state if the overlay state hasn't changed.
        // Avoids form components being called twice.
        if (this.state.dispaly_overlay !== display)
            this.setState({ dispaly_overlay: display });
    }

    placeItem = (node: Node) => {
        this.setState({ show_form: "place", dispaly_overlay: true, placedItem: node });
    }

    closeForm = (cancelled: boolean) => {
        if(this.state.show_form === "settings") {
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

    render() {
        // TODO: maybe could use router for overlay/forms.
        let form;
        if (this.state.show_form === 'instructions') form = <Instructions closeForm={this.closeForm} loadForm={this.loadForm} />
        else if (this.state.show_form === 'settings') form = <SettingsForm closeForm={this.closeForm} />;
        else if (this.state.show_form === 'mint') form = <MintFrom closeForm={this.closeForm} />;
        else if (this.state.show_form === 'place') form = <PlaceForm closeForm={this.closeForm} placedItem={this.state.placedItem} />;
        else if (this.state.show_form === 'inventory') form = <Inventory closeForm={this.closeForm} selectItemFromInventory={this.selectItemFromInventory} />;

        let overlay = !this.state.dispaly_overlay ? null :
            <div className="Explore-overlay">
                <div className='my-auto mx-auto'>
                    {form}
                </div>
            </div>

        let controlInfo = !this.state.dispaly_overlay ? null : <ControlsHelp/>;

        let toasts = this.state.notifications.map((v) => { return <Notification data={v} key={v.id}/> });

        return (
            <div className='Explore'>
                <small className='position-fixed bottom-0 end-0 text-white text-bolder mb-2 me-3' style={{zIndex: "1040"}}>{ "tz1aND v" + Conf.app_version}</small>
                {this.state.showFps ? <div id="fps">0</div> : null}
                {overlay}
                {controlInfo}
                <div className="toast-container position-fixed bottom-0 start-0 p-5 px-4" style={{zIndex: "1050"}}>{toasts}</div>
                <VirtualSpace ref={this.virtualSpaceRef} appControl={{
                    setOverlayDispaly: this.setOverlayDispaly,
                    loadForm: this.loadForm,
                    placeItem: this.placeItem,
                    addNotification: this.addNotification,
                }} />
            </div>
        );
    }
}
