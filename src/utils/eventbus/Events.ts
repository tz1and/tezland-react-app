import { NotificationData } from "../../components/Notification";
import { ChatMessage, OverlayForm, OverlayFormProps } from "../../world/AppControlFunctions";
import BasePlaceNode from "../../world/nodes/BasePlaceNode";
import { EventType, IAddNotification, IBaseEvent, IChangeCurrentPlace, IChatMessage, ILoadForm, IUnlockControls } from "./Types";


class BaseEvent implements IBaseEvent {
    public timestamp: Date;

    constructor(public type: EventType) {
        this.timestamp = new Date();
    }
}

export class ChatMessageEvent extends BaseEvent implements IChatMessage {
    constructor(public msg: ChatMessage) {
        super("chat-message");
    }
}

export class LoadFormEvent extends BaseEvent implements ILoadForm {
    constructor(public form_type: OverlayForm, public props?: OverlayFormProps) {
        super("load-form");
    }
}

export class AddNotificationEvent extends BaseEvent implements IAddNotification {
    constructor(public notification: NotificationData) {
        super("add-notification");
    }
}

export class ChangeCurrentPlaceEvent extends BaseEvent implements IChangeCurrentPlace {
    constructor(public place: BasePlaceNode | null) {
        super("change-current-place");
    }
}

export class UnlockControlsEvent extends BaseEvent implements IUnlockControls {
    constructor() {
        super("unlock-controls");
    }
}