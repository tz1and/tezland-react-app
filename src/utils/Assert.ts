export class AssertionError extends Error {
    constructor(message?: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "AssertionError";
    }
}

export function assert(value: unknown, message?: string): asserts value {
    if(!value) throw new AssertionError(message);
}