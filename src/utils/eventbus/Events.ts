import { NotificationData } from "../../components/Notification";
import { ChatMessage, OverlayForm, OverlayFormProps } from "../../world/AppControlFunctions";
import { tz1RoomState } from "../../world/MultiplayerClient";
import BasePlaceNode from "../../world/nodes/BasePlaceNode";
import { EventType, IAddNotification, IBaseEvent, IChangeCurrentPlace,
    IChatMessage, IChatRoom, ILoadForm, ISendChatMessage, IUnlockControls } from "./Types";


class BaseEvent implements IBaseEvent {
    public timestamp: Date;

    constructor(public type: EventType) {
        this.timestamp = new Date();
    }
}


// TODO: chat events: have a shared event for messages and players leaving/joining?
export class ChatRoomEvent extends BaseEvent implements IChatRoom {
    constructor(public room: tz1RoomState) {
        super("chat-message");
    }
}

export class ChatMessageEvent extends BaseEvent implements IChatMessage {
    constructor(public msg: ChatMessage) {
        super("chat-message");
    }
}

export class SendChatMessageEvent extends BaseEvent implements ISendChatMessage {
    constructor(public msg: string) {
        super("send-chat-message");
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