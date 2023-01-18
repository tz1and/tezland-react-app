import { NotificationData } from "../../components/Notification";
import { ChatMessage, OverlayForm, OverlayFormProps } from "../../world/AppControlFunctions";
import BasePlaceNode from "../../world/nodes/BasePlaceNode";

export type EventType = "chat-message" | "load-form" | "add-notification" | "change-current-place" | "unlock-controls";

/* Base Event */
export interface IBaseEvent {
    type: EventType;
    timestamp: Date;
}

/* Event Interfaces */
export interface IChatMessage extends IBaseEvent {
    msg: ChatMessage;
}

export interface ILoadForm extends IBaseEvent {
    form_type: OverlayForm;
    props?: OverlayFormProps | undefined;
}

export interface IAddNotification extends IBaseEvent {
    notification: NotificationData;
}

export interface IChangeCurrentPlace extends IBaseEvent {
    place: BasePlaceNode | null;
}

export interface IUnlockControls extends IBaseEvent { }

/* Global Events Interface */
export interface Events {
    "chat-message": IChatMessage;
    "load-form": ILoadForm;
    "add-notification": IAddNotification;
    "change-current-place": IChangeCurrentPlace;
    "unlock-controls": IUnlockControls;
}