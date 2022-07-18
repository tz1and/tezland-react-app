import { Nullable } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Ellipse, Image, TextBlock } from "@babylonjs/gui";
import handIcon from 'bootstrap-icons/icons/hand-index.svg';
import downloadIcon from 'bootstrap-icons/icons/cloud-download.svg';
import AppSettings from "../storage/AppSettings";
import assert from "assert";


export enum CursorType {
    Pointer = 0,
    Hand,
    Loading
}

// TODO: rename to... GuiController,,,, maybe?
export default class PickingGuiController {
    private advancedTexture: AdvancedDynamicTexture;

    private cursor: Nullable<Control>;
    private fps: Nullable<TextBlock>;

    constructor() {
        this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        // todo: get size from canvas?
        this.advancedTexture.idealHeight = 1920;
        this.advancedTexture.idealWidth = 1080;
        // TODO: rendering gui on a different layer requires another camera...
        //assert(this.advancedTexture.layer);
        //this.advancedTexture.layer.layerMask = 0x10000000;

        if (AppSettings.showFps.value) {
            this.fps = new TextBlock("fps");
            this.fps.color = '#eeeeee';
            this.fps.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_RIGHT;
            this.fps.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP;
            this.fps.top = 5;
            this.fps.left = -5;
            this.advancedTexture.addControl(this.fps);
        }
        else this.fps = null;

        // circle pointer
        this.cursor = this.createCursor(0);
        assert(this.cursor);
        this.advancedTexture.addControl(this.cursor);

        // crosshair
        /*var hor = new Rectangle();
        hor.widthInPixels = 10;
        hor.heightInPixels = 1;
        hor.background = "white";
        this.advancedTexture.addControl(hor);

        var vert = new Rectangle();
        vert.widthInPixels = 1;
        vert.heightInPixels = 10;
        vert.background = "white";
        this.advancedTexture.addControl(vert);*/
    }

    public dispose() {
        this.advancedTexture.dispose();
    }

    private createCursor(cursor: CursorType): Control {
        switch (cursor) {
            default:
            case CursorType.Pointer:
                var cursorPoint = new Ellipse();
                cursorPoint.widthInPixels = 4;
                cursorPoint.heightInPixels = 4;
                cursorPoint.color = "white";
                return cursorPoint;

            case CursorType.Hand:
                var cursorHand = new Image(undefined, handIcon);
                cursorHand.widthInPixels = 16;
                cursorHand.heightInPixels = 16;
                cursorHand.color = "white";
                return cursorHand;

            case CursorType.Loading:
                var cursorDownload = new Image(undefined, downloadIcon);
                cursorDownload.widthInPixels = 16;
                cursorDownload.heightInPixels = 16;
                cursorDownload.color = "white";
                return cursorDownload;
        }
    }

    // TODO: improve this to not constantly re-create the cursors.
    public setCursor(cursor: CursorType) {
        if (this.cursor) this.advancedTexture.removeControl(this.cursor);

        this.cursor = this.createCursor(cursor);
        this.advancedTexture.addControl(this.cursor);
    }

    public setFps(fps: number) {
        if (this.fps) this.fps.text = fps.toFixed() + " fps";
    }

    public addControl(control: Control) {
        this.advancedTexture.addControl(control);
    }
}