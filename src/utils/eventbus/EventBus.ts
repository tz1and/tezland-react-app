// Reference:
// https://medium.com/@nicatismayilov43/implementing-type-safe-and-generic-event-bus-in-typescript-752ba94984ec
// https://betterprogramming.pub/extending-global-event-system-with-typescript-generics-16c2c626fa25

import Observer, { Listener, IObserver } from "./Observer";
import { Events } from "./Types";

export * from "./Events";

type T = keyof Events;

type ObserversMap = {
    [Type in T]?: IObserver<Type>;
};

/* Singleton implementation of Global Event Bus */
class EventBus {
    private static instance: EventBus;
    private observers: ObserversMap = {};

    private constructor() { }

    static getInstance() {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }

        return EventBus.instance;
    }

    public publish<Type extends T>(type: Type, event: Events[Type]): void {
        if (!EventBus.getInstance().observers[type]) {
            EventBus.getInstance().observers = {
                ...EventBus.getInstance().observers,
                [type]: new Observer<Type>(),
            };
        }

        EventBus.getInstance().observers[type]!.publish(event);
    }

    public subscribe<Type extends T>(
        type: Type,
        listener: Listener<Type>
    ): void {
        if (!EventBus.getInstance().observers[type]) {
            EventBus.getInstance().observers = {
                ...EventBus.getInstance().observers,
                [type]: new Observer<Type>(),
            };
        }

        return EventBus.getInstance().observers[type]!.subscribe(listener);
    }

    public unsubscribe<Type extends T>(
        type: Type,
        listener: Listener<Type>
    ): void {
        if (!EventBus.getInstance().observers[type]) {
            EventBus.getInstance().observers = {
                ...EventBus.getInstance().observers,
                [type]: new Observer<Type>(),
            };
        }

        return EventBus.getInstance().observers[type]!.unsubscribe(listener);
    }
}

export default EventBus.getInstance();