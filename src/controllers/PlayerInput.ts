import { Scene, Engine, Observer, Nullable,
    KeyboardInfo, KeyboardEventTypes } from '@babylonjs/core';
import assert from 'assert';


export class PlayerKeyboardInput {

    public right: number = 0;
    public forward: number = 0;
    public up: number = 0;
    public jump: boolean = false;

    /**
     * Gets or Set the list of keyboard keys used to control the forward move of the camera.
     */
    public keysUp: number[] = [38];

    /**
     * Gets or Set the list of keyboard keys used to control the upward move of the camera.
     */
    public keysUpward: number[] = [33];

    /**
     * Gets or Set the list of keyboard keys used to control the backward move of the camera.
     */
    public keysDown: number[] = [40];

    /**
     * Gets or Set the list of keyboard keys used to control the downward move of the camera.
     */
    public keysDownward: number[] = [34];

    /**
     * Gets or Set the list of keyboard keys used to control the left strafe move of the camera.
     */
    public keysLeft: number[] = [37];

    /**
     * Gets or Set the list of keyboard keys used to control the right strafe move of the camera.
     */
    public keysRight: number[] = [39];

    /**
     * Gets or Set the list of keyboard keys used to control jumping.
     */
     public keysJump: number[] = [32];

    private _keys = new Array<number>();
    private _onCanvasBlurObserver: Nullable<Observer<Engine>> = null;
    private _onKeyboardObserver: Nullable<Observer<KeyboardInfo>> = null;
    private _engine: Nullable<Engine> = null;
    private _scene: Nullable<Scene> = null;

    public attachControl(scene: Scene): void {
        if (this._onCanvasBlurObserver) {
            return;
        }

        this._scene = scene;
        this._engine = this._scene.getEngine();

        this._onCanvasBlurObserver = this._engine.onCanvasBlurObservable.add(() => {
            this._keys.length = 0;
        });

        this._onKeyboardObserver = this._scene.onKeyboardObservable.add((info) => {
            let evt = info.event;
            if (!evt.metaKey) {
                if (info.type === KeyboardEventTypes.KEYDOWN) {
                    if (this.keysUp.indexOf(evt.keyCode) !== -1
                        || this.keysDown.indexOf(evt.keyCode) !== -1
                        || this.keysLeft.indexOf(evt.keyCode) !== -1
                        || this.keysRight.indexOf(evt.keyCode) !== -1
                        || this.keysUpward.indexOf(evt.keyCode) !== -1
                        || this.keysDownward.indexOf(evt.keyCode) !== -1
                        || this.keysJump.indexOf(evt.keyCode) !== -1) {
                        let index = this._keys.indexOf(evt.keyCode);

                        if (index === -1) {
                            this._keys.push(evt.keyCode);
                        }
                    }
                } else {
                    if (this.keysUp.indexOf(evt.keyCode) !== -1
                        || this.keysDown.indexOf(evt.keyCode) !== -1
                        || this.keysLeft.indexOf(evt.keyCode) !== -1
                        || this.keysRight.indexOf(evt.keyCode) !== -1
                        || this.keysUpward.indexOf(evt.keyCode) !== -1
                        || this.keysDownward.indexOf(evt.keyCode) !== -1
                        || this.keysJump.indexOf(evt.keyCode) !== -1) {
                        let index = this._keys.indexOf(evt.keyCode);

                        if (index >= 0) {
                            this._keys.splice(index, 1);
                        }
                    }
                }
            }
        });
    }

    /**
     * Detach the current controls from the specified dom element.
     * @param ignored defines an ignored parameter kept for backward compatibility. If you want to define the source input element, you can set engine.inputElement before calling camera.attachControl
     */
    public detachControl(ignored?: any): void {
        if (this._scene) {
            if (this._onKeyboardObserver) {
                this._scene.onKeyboardObservable.remove(this._onKeyboardObserver);
            }

            if (this._onCanvasBlurObserver) {
                assert(this._engine);
                this._engine.onCanvasBlurObservable.remove(this._onCanvasBlurObserver);
            }
            this._onKeyboardObserver = null;
            this._onCanvasBlurObserver = null;
        }
        this._keys.length = 0;
    }

    /**
     * Update the current camera state depending on the inputs that have been used this frame.
     * This is a dynamically created lambda to avoid the performance penalty of looping for inputs in the render loop.
     */
    public checkInputs(): void {
        if (this._onKeyboardObserver) {
            // Keyboard
            this.forward = 0;
            this.right = 0;
            this.up = 0;
            this.jump = false;
            for (let index = 0; index < this._keys.length; index++) {
                let keyCode = this._keys[index];

                if (this.keysLeft.indexOf(keyCode) !== -1) {
                    this.right = -1;
                } else if (this.keysUp.indexOf(keyCode) !== -1) {
                    this.forward = 1;
                } else if (this.keysRight.indexOf(keyCode) !== -1) {
                    this.right = 1;
                } else if (this.keysDown.indexOf(keyCode) !== -1) {
                    this.forward = -1;
                } else if (this.keysUpward.indexOf(keyCode) !== -1) {
                    this.up = 1;
                } else if (this.keysDownward.indexOf(keyCode) !== -1) {
                    this.up = -1;
                } else if (this.keysJump.indexOf(keyCode) !== -1) {
                    this.jump = true;
                    this.up = 1;
                }
            }
        }
    }

    /** @hidden */
    public _onLostFocus(): void {
        this._keys.length = 0;
    }
}