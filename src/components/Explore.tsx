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
    PlaceItemFromProps, TransferItemFromProps, CollectItemFromProps, ChatMessage } from '../world/AppControlFunctions';
import { LoadingError } from './LoadingError';
import BasePlaceNode from '../world/nodes/BasePlaceNode';
import { isDev, truncateAddress } from '../utils/Utils';
import { TermsForm } from '../forms/Terms';
import { BurnForm } from '../forms/BurnForm';
import { TransferForm } from '../forms/TransferForm';
import { DirectoryForm } from '../forms/DirectoryForm';
import assert from 'assert';
import { Helmet } from 'react-helmet-async';
import { CollectForm } from '../forms/CollectForm';
import TokenKey from '../utils/TokenKey';
import WorldLocation from '../utils/WorldLocation';
import { Logging } from '../utils/Logging';
import CBuffer from "CBuffer";
import { Button, Card, InputGroup } from 'react-bootstrap';


type ExploreProps = {
    // using `interface` is also ok
    //message: string;
};

type ExploreState = {
    show_form: OverlayForm;
    form_props?: OverlayFormProps | undefined;
    notifications: NotificationData[]; // TODO: should probably we a map from id to notification.
    currentPlace: BasePlaceNode | null;
    virtualSpaceFailed?: string;
    chatMessageBuffer: CBuffer<ChatMessage>;
};

export default class Explore extends React.Component<ExploreProps, ExploreState> {
    private virtualSpaceRef = React.createRef<VirtualSpace>();
    private chatInputRef = React.createRef<HTMLInputElement>();
    private messageContainer = React.createRef<HTMLDivElement>();

    constructor(props: ExploreProps) {
        super(props);
        this.state = {
            show_form: AppTerms.termsAccepted.value ? OverlayForm.Instructions : OverlayForm.Terms,
            notifications: [],
            currentPlace: null,
            chatMessageBuffer: new CBuffer<ChatMessage>(128)
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

    selectItemFromInventory = (tokenKey: TokenKey, quantity: number) => {
        this.loadForm(OverlayForm.None);

        const curVS = this.virtualSpaceRef.current;
        if (curVS) {
            curVS.setInventoryItem(tokenKey, quantity);
            curVS.lockControls();
        }
    }

    burnItemFromInventory = (tokenKey: TokenKey, quantity: number) => {
        this.loadForm(OverlayForm.BurnItem, { tokenKey: tokenKey, maxQuantity: quantity} as TransferItemFromProps);
    }

    transferItemFromInventory = (tokenKey: TokenKey, quantity: number) => {
        this.loadForm(OverlayForm.TransferItem, { tokenKey: tokenKey, maxQuantity: quantity} as TransferItemFromProps);
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

    newChatMessage = (msg: ChatMessage) => {
        this.state.chatMessageBuffer.push(msg);
        this.setState({chatMessageBuffer: this.state.chatMessageBuffer});
        this.scrollChatToBottom();
    }

    sendChatMessage = () => {
        const input = this.chatInputRef.current;
        const curVS = this.virtualSpaceRef.current;
        if (input && curVS && input.value.length > 0) {
            curVS.sendChatMessage(input.value);
            input.value = "";
        }
    }

    scrollChatToBottom = () => {
        const div = this.messageContainer.current;
        if(div) {
            const scroll = div.scrollHeight - div.clientHeight;
            div.scrollTo(0, scroll);
        }
    };

    updatePlaceInfo = (place: BasePlaceNode | null) => {
        this.setState({currentPlace: place});
    }

    getCurrentLocation = (): [number, number, number] => {
        const curVS = this.virtualSpaceRef.current;
        if (curVS) return curVS.getCurrentLocation();
        return [0, 0, 0];
    }

    teleportToLocation = (location: WorldLocation): void => {
        const curVS = this.virtualSpaceRef.current;
        if (curVS) curVS.teleportToLocation(location);
    };

    handleFileDrop = (fileList: FileList) => {
        const curVS = this.virtualSpaceRef.current;
        if (curVS) curVS.handleDroppedFile(fileList.item(0)!);
    };

    virtualSpaceFailed = (e: any) => {
        Logging.Error("Failed to load:", e);
        this.setState({virtualSpaceFailed: e.toString()});
    }

    private getFormElement(): JSX.Element | undefined {
        switch (this.state.show_form) {
            default:
            case OverlayForm.None:
                return undefined;

            case OverlayForm.Instructions:
                return <Instructions currentPlace={this.state.currentPlace}
                    closeForm={this.closeForm}
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
        if(this.state.virtualSpaceFailed) return <LoadingError errorMsg={this.state.virtualSpaceFailed}/>;

        const overlay = this.getOverlay();

        const controlInfo = overlay ? <ControlsHelp/> : null;

        {/* Move place overlay to component */}
        const placeInfoOverlay = !overlay && this.state.currentPlace ?
            <div className='position-fixed top-0 start-0 bg-white p-3 m-2 rounded-1'>
                <h5 className='mb-0'>{this.state.currentPlace.getName()}</h5>
                <small className='text-muted'>#{this.state.currentPlace.placeKey.id}</small>
                <hr/>
                Owner: {this.state.currentPlace.currentOwner}<br/>
                Permissions: {this.state.currentPlace.getPermissions.toString()}
            </div> : null;

        const toasts = this.state.notifications.map((v) => { return <Notification data={v} key={v.id}/> });

        const chatActive = this.state.show_form === OverlayForm.Instructions;
        const chatVisible = this.state.show_form === OverlayForm.Instructions || this.state.show_form === OverlayForm.None;

        return (
            <div className='Explore'>
                <Helmet>
                    <title>tz1and - Explore</title>
                </Helmet>
                <small className='position-fixed bottom-0 end-0 text-white text-bolder mb-2 me-3' style={{zIndex: "1040"}}>{ "tz1and v" + Conf.app_version} (beta)</small>
                {overlay}
                {controlInfo}
                {/* Move chat to component */}
                {chatVisible && <div className={`position-absolute chatPanel ${!chatActive && 'chatPanelInactive'}`}>
                    <Card className={`chatCard ${!chatActive && 'chatCardInactive'}`}>
                        <Card.Body className='messageContainer' ref={this.messageContainer}>
                            {this.state.chatMessageBuffer.map((msg, idx) => {return <p className='m-1' key={idx}><b>{msg.from ? truncateAddress(msg.from) : "System"}</b>: {msg.msg}</p>}).toArray()}
                        </Card.Body>
                        {chatActive && <Card.Footer>
                            <InputGroup>
                                <input autoComplete="off" type="text" ref={this.chatInputRef} name="chat-input" className="form-control chatInput" placeholder="Type your message..." onKeyDown={(e) => e.key === 'Enter' && this.sendChatMessage()} />
                                <Button disabled={!chatActive} onClick={this.sendChatMessage}>Send</Button>
                            </InputGroup>
                        </Card.Footer>}
                    </Card>
                </div>}
                {placeInfoOverlay}
                <div className="toast-container position-fixed bottom-0 start-0 p-5 px-4" style={{zIndex: "1050"}}>{toasts}</div>
                <VirtualSpace ref={this.virtualSpaceRef} appControl={{
                    loadForm: this.loadForm,
                    addNotification: this.addNotification,
                    newChatMessage: this.newChatMessage,
                    updatePlaceInfo: this.updatePlaceInfo,
                    unlockControls: this.unlockControls
                }} errorCallback={this.virtualSpaceFailed} />
                { isDev() ? <div id="inspector-host" /> : null }
            </div>
        );
    }
}
