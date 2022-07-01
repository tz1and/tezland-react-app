import { EventState, FreeCamera, ICameraInput, IMouseEvent, IPointerEvent, IWheelEvent, Nullable, Observable, Observer, PointerEventTypes, PointerInfo, Tools } from "@babylonjs/core";
import assert from "assert";

/**
 * Manage the mouse inputs to control the movement of a free camera.
 * @see https://doc.babylonjs.com/how_to/customizing_camera_inputs
 */
export class OrthoCameraMouseInput implements ICameraInput<FreeCamera> {
    /**
     * Defines the camera the input is attached to.
     */
    public camera: Nullable<FreeCamera> = null;

    /**
     * Defines the buttons associated with the input to handle camera move.
     */
    public buttons = [0, 1, 2];

    private _pointerInput?: (p: PointerInfo, s: EventState) => void;
    private _onMouseMove?: Nullable<(e: IMouseEvent) => any>;
    private _observer: Nullable<Observer<PointerInfo>> = null;
    private _previousPosition: Nullable<{ x: number; y: number }> = null;

    /**
     * Observable for when a pointer move event occurs containing the move offset
     */
    public onPointerMovedObservable = new Observable<{ offsetX: number; offsetY: number }>();

    private _currentActiveButton: number = -1;

    private _contextMenuBind?: () => void;

    /**
     * Manage the mouse inputs to control the movement of a free camera.
     * @see https://doc.babylonjs.com/how_to/customizing_camera_inputs
     * @param touchEnabled Defines if touch is enabled or not
     */
    constructor(
        /**
         * Define if touch is enabled in the mouse input
         */
        public touchEnabled = true
    ) { }

    /**
     * Attach the input controls to a specific dom element to get the input from.
     * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
     */
    public attachControl(noPreventDefault?: boolean): void {
        assert(this.camera);
        // eslint-disable-next-line prefer-rest-params
        noPreventDefault = Tools.BackCompatCameraNoPreventDefault(arguments);
        const engine = this.camera.getEngine();
        const element = engine.getInputElement();

        if (!this._pointerInput) {
            this._pointerInput = (p) => {
                assert(this.camera);
                const evt = p.event as IPointerEvent;
                const isTouch = evt.pointerType === "touch";

                if (engine.isInVRExclusivePointerMode) {
                    return;
                }

                if (!this.touchEnabled && isTouch) {
                    return;
                }

                if (p.type !== PointerEventTypes.POINTERMOVE && this.buttons.indexOf(evt.button) === -1) {
                    return;
                }

                const srcElement = (evt.srcElement || evt.target) as HTMLElement;

                if (p.type === PointerEventTypes.POINTERDOWN && (this._currentActiveButton === -1 || isTouch)) {
                    try {
                        srcElement?.setPointerCapture(evt.pointerId);
                    } catch (e) {
                        //Nothing to do with the error. Execution will continue.
                    }

                    if (this._currentActiveButton === -1) {
                        this._currentActiveButton = evt.button;
                    }

                    this._previousPosition = {
                        x: evt.clientX,
                        y: evt.clientY,
                    };

                    if (!noPreventDefault) {
                        evt.preventDefault();
                        element && element.focus();
                    }

                    // This is required to move while pointer button is down
                    if (engine.isPointerLock && this._onMouseMove) {
                        this._onMouseMove(p.event);
                    }
                } else if (p.type === PointerEventTypes.POINTERUP && (this._currentActiveButton === evt.button || isTouch)) {
                    try {
                        srcElement?.releasePointerCapture(evt.pointerId);
                    } catch (e) {
                        //Nothing to do with the error.
                    }
                    this._currentActiveButton = -1;

                    this._previousPosition = null;
                    if (!noPreventDefault) {
                        evt.preventDefault();
                    }
                } else if (p.type === PointerEventTypes.POINTERMOVE) {
                    if (engine.isPointerLock && this._onMouseMove) {
                        this._onMouseMove(p.event);
                    } else if (this._previousPosition) {
                        let offsetX = evt.clientX - this._previousPosition.x;
                        const offsetY = evt.clientY - this._previousPosition.y;
                        if (this.camera.getScene().useRightHandedSystem) {
                            offsetX *= -1;
                        }
                        if (this.camera.parent && this.camera.parent._getWorldMatrixDeterminant() < 0) {
                            offsetX *= -1;
                        }

                        const orthoW = this.camera.orthoRight! - this.camera.orthoLeft!;
                        const orthoH = this.camera.orthoTop! - this.camera.orthoBottom!;

                        this.camera.position.x += offsetX / srcElement.clientWidth * orthoW;
                        this.camera.position.z -= offsetY / srcElement.clientHeight * orthoH;

                        this.onPointerMovedObservable.notifyObservers({ offsetX: offsetX, offsetY: offsetY });

                        this._previousPosition = {
                            x: evt.clientX,
                            y: evt.clientY,
                        };

                        if (!noPreventDefault) {
                            evt.preventDefault();
                        }
                    }
                } else if (p.type === PointerEventTypes.POINTERWHEEL) {
                    const event = p.event as IWheelEvent;
                    const scale = 1 + event.deltaY * 0.005;

                    // TODO: minmax to limit zoom

                    // Calculate new scale.
                    // We assume ortho left and ortho right to be equal.
                    const MAX_SCALE = 750;
                    const MIN_SCALE = 50;
                    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.camera.orthoRight! * scale)) / this.camera.orthoRight!;

                    this.camera.orthoRight! *= newScale;
                    this.camera.orthoLeft! *= newScale;
                    this.camera.orthoTop! *= newScale;
                    this.camera.orthoBottom! *= newScale;

                    this.onPointerMovedObservable.notifyObservers({ offsetX: 0, offsetY: 0 });

                    //if (!noPreventDefault) {
                        evt.preventDefault();
                    //}
                }
            };
        }

        this._onMouseMove = (evt) => {
            assert(this.camera);
            if (!engine.isPointerLock) {
                return;
            }

            if (engine.isInVRExclusivePointerMode) {
                return;
            }

            let offsetX = evt.movementX || evt.mozMovementX || evt.webkitMovementX || evt.msMovementX || 0;
            if (this.camera.getScene().useRightHandedSystem) {
                offsetX *= -1;
            }
            if (this.camera.parent && this.camera.parent._getWorldMatrixDeterminant() < 0) {
                offsetX *= -1;
            }
            
            const orthoW = this.camera.orthoRight! - this.camera.orthoLeft!;
            const orthoH = this.camera.orthoTop! - this.camera.orthoBottom!;
            
            this.camera.position.x += offsetX / element!.clientWidth * orthoW;

            const offsetY = evt.movementY || evt.mozMovementY || evt.webkitMovementY || evt.msMovementY || 0;
            this.camera.position.z -= offsetY / element!.clientHeight * orthoH;

            this._previousPosition = null;

            if (!noPreventDefault) {
                evt.preventDefault();
            }
        };

        this._observer = this.camera
            .getScene()
            .onPointerObservable.add(this._pointerInput, PointerEventTypes.POINTERWHEEL | PointerEventTypes.POINTERDOWN | PointerEventTypes.POINTERUP | PointerEventTypes.POINTERMOVE);

        if (element) {
            // @ts-expect-error
            this._contextMenuBind = this.onContextMenu.bind(this);
            // @ts-expect-error
            element.addEventListener("contextmenu", this._contextMenuBind, false); // TODO: We need to figure out how to handle this for Native
        }
    }

    /**
     * Called on JS contextmenu event.
     * Override this method to provide functionality.
     * @param evt
     */
    public onContextMenu(evt: PointerEvent): void {
        evt.preventDefault();
    }

    /**
     * Detach the current controls from the specified dom element.
     */
    public detachControl(): void {
        if (this._observer) {
            assert(this.camera);
            this.camera.getScene().onPointerObservable.remove(this._observer);

            if (this._contextMenuBind) {
                const engine = this.camera.getEngine();
                const element = engine.getInputElement();
                element && element.removeEventListener("contextmenu", this._contextMenuBind);
            }

            if (this.onPointerMovedObservable) {
                this.onPointerMovedObservable.clear();
            }

            this._observer = null;
            this._onMouseMove = null;
            this._previousPosition = null;
        }

        this._currentActiveButton = -1;
    }

    /**
     * Gets the class name of the current input.
     * @returns the class name
     */
    public getClassName(): string {
        return "OrthoCameraMouseInput";
    }

    /**
     * Get the friendly name associated with the input class.
     * @returns the input friendly name
     */
    public getSimpleName(): string {
        return "mouse";
    }
}
