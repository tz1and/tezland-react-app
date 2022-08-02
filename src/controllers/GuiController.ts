import { Nullable } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Ellipse, Image, TextBlock } from "@babylonjs/gui";
import AppSettings from "../storage/AppSettings";
import handIcon from 'bootstrap-icons/icons/hand-index.svg';
import downloadIcon from 'bootstrap-icons/icons/cloud-download.svg';
import worldIcon from 'bootstrap-icons/icons/globe2.svg';
import { TeleporterData, TeleporterType } from "../utils/ItemData";


export const enum CursorType {
    Pointer = 0,
    Hand,
    Loading,
    World,
    None
}

export default class GuiController {
    private advancedTexture: AdvancedDynamicTexture;

    private cursors: Map<CursorType, Control> = new Map();
    private activeCursor: Nullable<Control> = null;
    private fps: Nullable<TextBlock>;

    private teleporterText: TextBlock;

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

        this.teleporterText = new TextBlock("telepoterText");
        this.teleporterText.color = '#eeeeee';
        this.teleporterText.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
        this.teleporterText.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_CENTER;
        this.teleporterText.top = 32;
        this.teleporterText.isVisible = false;
        this.advancedTexture.addControl(this.teleporterText);

        // Create cursors
        this.cursors.set(CursorType.Pointer, this.createCursor(CursorType.Pointer));
        this.cursors.set(CursorType.Hand, this.createCursor(CursorType.Hand));
        this.cursors.set(CursorType.Loading, this.createCursor(CursorType.Loading));
        this.cursors.set(CursorType.World, this.createCursor(CursorType.World));

        this.setCursor(CursorType.Pointer);

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
        let cursorControl: Control;
        switch (cursor) {
            default:
            case CursorType.Pointer:
                cursorControl = new Ellipse();
                cursorControl.widthInPixels = 4;
                cursorControl.heightInPixels = 4;
                break;

            case CursorType.Hand:
                cursorControl = new Image(undefined, handIcon);
                cursorControl.widthInPixels = 16;
                cursorControl.heightInPixels = 16;
                break;

            case CursorType.Loading:
                cursorControl = new Image(undefined, downloadIcon);
                cursorControl.widthInPixels = 16;
                cursorControl.heightInPixels = 16;
                break;

            case CursorType.World:
                cursorControl = new Image(undefined, worldIcon);
                cursorControl.widthInPixels = 16;
                cursorControl.heightInPixels = 16;
                break;
        }

        cursorControl.color = "white";
        cursorControl.isVisible = false;
        this.advancedTexture.addControl(cursorControl);
        return cursorControl;
    }

    public showTeleporterInfo(data: TeleporterData) {
        const baseText = "\nLeft click to activate."

        switch(data.type) {
            case TeleporterType.Exterior:
                this.teleporterText.text = `Teleporter to Place #${data.placeId!}${baseText}`;
                break;

            case TeleporterType.Interior:
                this.teleporterText.text = `Teleporter to Interior #${data.placeId!}${baseText}`;
                break;

            case TeleporterType.Local:
                this.teleporterText.text = `A local teleporter in this place.${baseText}`;
                break;

            default:
                this.teleporterText.text = `No idea where this one goes :) Try it!${baseText}`;
        }

        this.teleporterText.isVisible = true;
        this.setCursor(CursorType.World);
    }

    // TODO: improve this to not constantly re-create the cursors.
    public setCursor(cursor: CursorType) {
        if (this.activeCursor) {
            this.activeCursor.isVisible = false;
            this.activeCursor = null;
        }
        
        const newActiveCursor = this.cursors.get(cursor);
        if (newActiveCursor) {
            this.activeCursor = newActiveCursor;
            this.activeCursor.isVisible = true;
        }

        if (cursor !== CursorType.World) this.teleporterText.isVisible = false;
    }

    public setFps(fps: number) {
        if (this.fps) this.fps.text = fps.toFixed() + " fps";
    }

    public addControl(control: Control) {
        this.advancedTexture.addControl(control);
    }
}