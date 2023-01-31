import React from 'react';
import './Explore.css';
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
    PlaceItemFromProps, TransferItemFromProps,
    CollectItemFromProps } from '../world/AppControlFunctions';
import { LoadingError } from './LoadingError';
import BasePlaceNode from '../world/nodes/BasePlaceNode';
import { isDev } from '../utils/Utils';
import { TermsForm } from '../forms/Terms';
import { BurnForm } from '../forms/BurnForm';
import { TransferForm } from '../forms/TransferForm';
import { DirectoryForm } from '../forms/DirectoryForm';
import { CollectForm } from '../forms/CollectForm';
import TokenKey from '../utils/TokenKey';
import WorldLocation from '../utils/WorldLocation';
import { Chat } from './overlay/Chat';
import { PlaceInfo } from './overlay/PlaceInfo';
import { Game } from '../world/Game';
import EventBus, { AddNotificationEvent, ChangeCurrentPlaceEvent,
    LoadFormEvent, UnlockControlsEvent } from '../utils/eventbus/EventBus';
import { assert } from '../utils/Assert';


type ExploreProps = {
    game: Game | null;
    loadError: any | undefined;
};

type ExploreState = {
    show_form: OverlayForm;
    form_props?: OverlayFormProps | undefined;
    notifications: NotificationData[]; // TODO: should probably we a map from id to notification.
    currentPlace: BasePlaceNode | null;
};

export default class Explore extends React.Component<ExploreProps, ExploreState> {
    constructor(props: ExploreProps) {
        super(props);
        this.state = {
            show_form: AppTerms.termsAccepted.value ? OverlayForm.Instructions : OverlayForm.Terms,
            notifications: [],
            currentPlace: null
        };
    }

    override componentDidMount(): void {
        EventBus.subscribe("load-form", this.loadForm);
        EventBus.subscribe("add-notification", this.addNotification);
        EventBus.subscribe("change-current-place", this.updatePlaceInfo);
        EventBus.subscribe("unlock-controls", this.unlockControls);
    }

    override componentWillUnmount(): void {
        EventBus.unsubscribe("load-form", this.loadForm);
        EventBus.unsubscribe("add-notification", this.addNotification);
        EventBus.unsubscribe("change-current-place", this.updatePlaceInfo);
        EventBus.unsubscribe("unlock-controls", this.unlockControls);
    }

    loadForm = (e: LoadFormEvent) => {
        this._loadForm(e.form_type, e.props);
    }

    private _loadForm(form_type: OverlayForm, props?: OverlayFormProps) {
        this.setState({
            show_form: form_type,
            form_props: props
        });
    }

    // TODO: close form can *probaby* go through the EventBus?
    // Though, have to be careful not to introduce unwanted behaviour.
    closeForm = () => {
        if (this.state.show_form === OverlayForm.Settings || this.state.show_form === OverlayForm.Terms) {
            this._loadForm(OverlayForm.Instructions);
            return;
        }

        this._loadForm(OverlayForm.None);

        this.props.game?.engine.enterPointerlock();
    }

    unlockControls = (e: UnlockControlsEvent) => {
        if (this.state.show_form === OverlayForm.None)
            this._loadForm(OverlayForm.Instructions);
    }

    selectItemFromInventory = (tokenKey: TokenKey, quantity: number) => {
        this._loadForm(OverlayForm.None);

        assert(this.props.game);
        this.props.game.playerController.selectItemForPlacement(tokenKey, quantity);
        this.props.game?.engine.enterPointerlock();
    }

    // TODO: use EventBus where it's passed.
    burnItemFromInventory = (tokenKey: TokenKey, quantity: number) => {
        const props: TransferItemFromProps = { tokenKey: tokenKey, maxQuantity: quantity};
        this._loadForm(OverlayForm.BurnItem, props);
    }

    // TODO: use EventBus where it's passed.
    transferItemFromInventory = (tokenKey: TokenKey, quantity: number) => {
        const props: TransferItemFromProps = { tokenKey: tokenKey, maxQuantity: quantity};
        this._loadForm(OverlayForm.TransferItem, props);
    }

    addNotification = (e: AddNotificationEvent) => {
        // TODO: move notification hadnling into it's own component.
        // Don't add notification if one with the same id exists.
        if(this.state.notifications.find((n) => e.notification.id === n.id)) return;

        this.setState({ notifications: this.state.notifications.concat(e.notification) });

        // warnign: dangling timeout
        setTimeout(() => {
            const newNotifications: NotificationData[] = [];
            for(const p of this.state.notifications) {
                if(p.id !== e.notification.id) newNotifications.push(p);
            }
            this.setState({notifications: newNotifications});
        }, 10000);
    }

    updatePlaceInfo = (e: ChangeCurrentPlaceEvent) => {
        this.setState({currentPlace: e.place});
    }

    getCurrentLocation = (): [number, number, number] => {
        assert(this.props.game);
        const pos = this.props.game.playerController.getPosition();
        return [pos.x, pos.y, pos.z];
    }

    teleportToLocation = (location: WorldLocation): void => {
        assert(this.props.game);
        this.props.game.teleportTo(location);
    };

    handleFileDrop = (fileList: FileList) => {
        assert(this.props.game);
        this.props.game.playerController.handleDroppedFile(fileList.item(0)!);
    };

    private getFormElement(): JSX.Element | undefined {
        switch (this.state.show_form) {
            default:
            case OverlayForm.None:
                return undefined;

            case OverlayForm.Instructions:
                return <Instructions currentPlace={this.state.currentPlace}
                    closeForm={this.closeForm}
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
                return <BurnForm closeForm={this.closeForm} tokenKey={burnItemProps.tokenKey} maxQuantity={burnItemProps.maxQuantity} />;

            case OverlayForm.TransferItem:
                assert(this.state.form_props);
                const transferItemProps = this.state.form_props as TransferItemFromProps;
                return <TransferForm closeForm={this.closeForm} tokenKey={transferItemProps.tokenKey} maxQuantity={transferItemProps.maxQuantity} />;

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
        if(this.props.loadError) return <LoadingError errorMsg={this.props.loadError.toString()}/>;

        const overlay = this.getOverlay();

        const controlInfo = overlay ? <ControlsHelp/> : null;

        const toasts = this.state.notifications.map((v) => { return <Notification data={v} key={v.id}/> });

        return (
            <div className='Explore'>
                <small className='position-fixed bottom-0 end-0 text-white text-bolder mb-2 me-3' style={{zIndex: "1040"}}>{ "tz1and v" + Conf.app_version} (beta)</small>
                {overlay}
                {controlInfo}
                <Chat overlayState={this.state.show_form} />
                <PlaceInfo show={!overlay} currentPlace={this.state.currentPlace}/>
                <div className="toast-container position-fixed bottom-0 start-0 p-5 px-4" style={{zIndex: "1050"}}>{toasts}</div>
                { isDev() ? <div id="inspector-host" /> : null }
            </div>
        );
    }
}
