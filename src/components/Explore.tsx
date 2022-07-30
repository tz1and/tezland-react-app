import React from 'react';
import './Explore.css';
import VirtualSpace from './VirtualSpace';
import { MintFrom } from '../forms/MintForm';
import { PlaceForm } from '../forms/PlaceForm';
import { Inventory } from '../forms/Inventory';
import { Instructions } from '../forms/Instructions';
import { ControlsHelp } from './ControlsHelp';
import { SettingsForm } from '../forms/SettingsForm';
import { AppTerms } from '../storage/AppSettings';
import { Notification, NotificationData } from './Notification';
import Conf from '../Config';
import { EditPlace } from '../forms/EditPlace';
import { OverlayForm, DirectoryFormProps, OverlayFormProps,
    PlaceItemFromProps, TransferItemFromProps, CollectItemFromProps } from '../world/AppControlFunctions';
import { LoadingError } from './LoadingError';
import BasePlaceNode from '../world/nodes/BasePlaceNode';
import { isDev } from '../utils/Utils';
import { TermsForm } from '../forms/Terms';
import { BurnForm } from '../forms/BurnForm';
import { TransferForm } from '../forms/TransferForm';
import { DirectoryForm } from '../forms/DirectoryForm';
import assert from 'assert';
import { Helmet } from 'react-helmet-async';
import { CollectForm } from '../forms/CollectForm';


type ExploreProps = {
    // using `interface` is also ok
    //message: string;
};

type ExploreState = {
    show_form: OverlayForm;
    form_props?: OverlayFormProps | undefined;
    notifications: NotificationData[]; // TODO: should probably we a map from id to notification.
    currentPlace: BasePlaceNode | null;
    virtualSpaceFailed: boolean;
};

export default class Explore extends React.Component<ExploreProps, ExploreState> {
    private virtualSpaceRef = React.createRef<VirtualSpace>();

    constructor(props: ExploreProps) {
        super(props);
        this.state = {
            show_form: AppTerms.termsAccepted.value ? OverlayForm.Instructions : OverlayForm.Terms,
            notifications: [],
            currentPlace: null,
            virtualSpaceFailed: false
        };
    }

    loadForm = (form_type: OverlayForm, props?: OverlayFormProps) => {
        this.setState({
            show_form: form_type,
            form_props: props
        });
    }

    closeForm = () => {
        if (this.state.show_form === OverlayForm.Settings || this.state.show_form === OverlayForm.Terms) {
            this.loadForm(OverlayForm.Instructions);
            return;
        }

        this.loadForm(OverlayForm.None);

        this.virtualSpaceRef.current?.lockControls();
    }

    unlockControls = () => {
        if (this.state.show_form === OverlayForm.None)
            this.loadForm(OverlayForm.Instructions);
    }

    selectItemFromInventory = (id: number, quantity: number) => {
        this.loadForm(OverlayForm.None);

        const curVS = this.virtualSpaceRef.current;
        if (curVS) {
            curVS.setInventoryItem(id, quantity);
            curVS.lockControls();
        }
    }

    burnItemFromInventory = (id: number, quantity: number) => {
        this.loadForm(OverlayForm.BurnItem, { tokenId: id, maxQuantity: quantity} as TransferItemFromProps);
    }

    transferItemFromInventory = (id: number, quantity: number) => {
        this.loadForm(OverlayForm.TransferItem, { tokenId: id, maxQuantity: quantity} as TransferItemFromProps);
    }

    addNotification = (data: NotificationData) => {
        // TODO: move notification hadnling into it's own component.
        // Don't add notification if one with the same id exists.
        if(this.state.notifications.find((n) => data.id === n.id)) return;

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

    updatePlaceInfo = (place: BasePlaceNode | null) => {
        this.setState({currentPlace: place});
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

    teleportToWorldPos = (pos: [number, number]): void => {
        const curVS = this.virtualSpaceRef.current;
        if (curVS) curVS.teleportToWorldPos(pos);
    };

    handleFileDrop = (fileList: FileList) => {
        const curVS = this.virtualSpaceRef.current;
        if (curVS) curVS.handleDroppedFile(fileList.item(0)!);
    };

    virtualSpaceFailed = (e: any) => {
        this.setState({virtualSpaceFailed: true});
    }

    private getFormElement(): JSX.Element | undefined {
        switch (this.state.show_form) {
            default:
            case OverlayForm.None:
                return undefined;

            case OverlayForm.Instructions:
                return <Instructions closeForm={this.closeForm}
                    loadForm={this.loadForm}
                    getCurrentLocation={this.getCurrentLocation}
                    teleportToLocation={this.teleportToLocation}
                    handleFileDrop={this.handleFileDrop} />

            case OverlayForm.Terms: 
                return <TermsForm closeForm={this.closeForm} />;

            case OverlayForm.Settings:
                return <SettingsForm closeForm={this.closeForm} />;

            case OverlayForm.Mint:
                return <MintFrom closeForm={this.closeForm} />;

            case OverlayForm.PlaceItem:
                assert(this.state.form_props);
                const placeItemProps = this.state.form_props as PlaceItemFromProps;
                return <PlaceForm closeForm={this.closeForm} placedItem={placeItemProps.node} maxQuantity={placeItemProps.maxQuantity} />

            case OverlayForm.Inventory:
                return <Inventory closeForm={this.closeForm}
                    selectItemFromInventory={this.selectItemFromInventory}
                    burnItemFromInventory={this.burnItemFromInventory}
                    transferItemFromInventory={this.transferItemFromInventory} />;

            case OverlayForm.BurnItem:
                assert(this.state.form_props);
                const burnItemProps = this.state.form_props as TransferItemFromProps;
                return <BurnForm closeForm={this.closeForm} itemId={burnItemProps.tokenId} maxQuantity={burnItemProps.maxQuantity} />;

            case OverlayForm.TransferItem:
                assert(this.state.form_props);
                const transferItemProps = this.state.form_props as TransferItemFromProps;
                return <TransferForm closeForm={this.closeForm} itemId={transferItemProps.tokenId} maxQuantity={transferItemProps.maxQuantity} />;

            case OverlayForm.CollectItem:
                assert(this.state.form_props);
                const collectItemProps = this.state.form_props as CollectItemFromProps;
                return <CollectForm closeForm={this.closeForm} {...collectItemProps} />;

            case OverlayForm.PlaceProperties:
                return <EditPlace closeForm={this.closeForm} place={this.state.currentPlace!} />;

            case OverlayForm.Directory:
                assert(this.state.form_props);
                const directoryFormProps = this.state.form_props as DirectoryFormProps;
                return <DirectoryForm iFrameControl={{
                    teleportToWorldPos: this.teleportToWorldPos,
                    teleportToLocation: this.teleportToLocation,
                    closeForm: this.closeForm
                }} {...directoryFormProps} />;
        }
    }

    private getOverlay() {
        const form = this.getFormElement();
        if (!form) return undefined;

        return (
            <div className="Explore-overlay">
                <div className='my-auto mx-auto'>
                    {form}
                </div>
            </div>);
    }

    override render() {
        // NOTE: maybe could use router for overlay/forms.
        if(this.state.virtualSpaceFailed) return <LoadingError/>;

        const overlay = this.getOverlay();

        const controlInfo = overlay ? <ControlsHelp/> : null;

        const placeInfoOverlay = !overlay && this.state.currentPlace ?
            <div className='position-fixed top-0 start-0 bg-white p-3 m-2 rounded-1'>
                <h5 className='mb-0'>{this.state.currentPlace.getName()}</h5>
                <small className='text-muted'>#{this.state.currentPlace.placeId}</small>
                <hr/>
                Owner: {this.state.currentPlace.currentOwner}<br/>
                Permissions: {this.state.currentPlace.getPermissions.toString()}
            </div> : null;

        const toasts = this.state.notifications.map((v) => { return <Notification data={v} key={v.id}/> });

        return (
            <div className='Explore'>
                <Helmet>
                    <title>tz1and - Explore</title>
                </Helmet>
                <small className='position-fixed bottom-0 end-0 text-white text-bolder mb-2 me-3' style={{zIndex: "1040"}}>{ "tz1and v" + Conf.app_version} (beta)</small>
                {overlay}
                {controlInfo}
                {placeInfoOverlay}
                <div className="toast-container position-fixed bottom-0 start-0 p-5 px-4" style={{zIndex: "1050"}}>{toasts}</div>
                <VirtualSpace ref={this.virtualSpaceRef} appControl={{
                    loadForm: this.loadForm,
                    addNotification: this.addNotification,
                    updatePlaceInfo: this.updatePlaceInfo,
                    unlockControls: this.unlockControls
                }} errorCallback={this.virtualSpaceFailed} />
                { isDev() ? <div id="inspector-host" /> : null }
            </div>
        );
    }
}
