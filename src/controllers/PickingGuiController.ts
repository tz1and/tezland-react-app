import { Node, Nullable, PointerEventTypes, TransformNode } from "@babylonjs/core";

import { AdvancedDynamicTexture, Control, Ellipse, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import Contracts from "../tz/Contracts";
import { truncate } from "../tz/Utils";
import Metadata from "../world/Metadata";
import { InstanceMetadata } from "../world/Place";
import { World } from "../world/World";

export default class PickingGuiController {

    private world: World;
    private advancedTexture: AdvancedDynamicTexture;
    private current_node: Nullable<TransformNode>;

    private infoGui: Nullable<Control>;
    private hud: Control;

    constructor(world: World) {
        this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        // todo: get size from canvas?
        this.advancedTexture.idealHeight = 1920;
        this.advancedTexture.idealWidth = 1080;

        this.current_node = null;
        this.infoGui = null;
        this.world = world;

        // pointer actions
        // mouse interaction when locked
        this.world.scene.onPointerObservable.add(async (info, eventState) => {
            // button 2 is right click.
            if (info.type === PointerEventTypes.POINTERDOWN && info.event.button === 2) {
                if(this.current_node) {
                    const metadata = this.getInstanceMetadata(this.current_node);

                    if(metadata && metadata.xtzPerItem !== 0) {
                        document.exitPointerLock();
                        Contracts.getItem(metadata.placeId, metadata.id.toNumber(), metadata.xtzPerItem).then(() => {
                            world.places.get(metadata.placeId)?.loadItems();
                        })
                    }

                    eventState.skipNextObservers = true;
                }
            }
        }, PointerEventTypes.POINTERDOWN);

        // circle pointer
        var circ = new Ellipse();
        circ.widthInPixels = 4;
        circ.heightInPixels = 4;
        circ.color = "white";
        this.advancedTexture.addControl(circ);

        // HUD
        this.hud = this.generateHUD();
        this.advancedTexture.addControl(this.hud);

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

    private generateHUD(): Control {
        var rect = new Rectangle();
        rect.widthInPixels = 120;
        rect.heightInPixels = 140;
        //rect.cornerRadius = 5;
        rect.thickness = 0;
        //rect.color = "black";
        //rect.background = "white";
        rect.horizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        rect.verticalAlignment = StackPanel.VERTICAL_ALIGNMENT_BOTTOM;
        this.advancedTexture.addControl(rect);

        var panel = new StackPanel();
        panel.width = 0.90;
        panel.height = 0.95;
        //panel.logLayoutCycleErrors = true; // TEMP*/
        rect.addControl(panel);

        /*var label = new TextBlock();
        label.fontSize = "12px";
        label.height = "16px";
        label.width = 1;
        label.text = "Controls";
        label.textHorizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(label);*/

        var label = new TextBlock();
        label.fontSize = "10px";
        label.height = 12 * 11 + "px";
        label.width = 1;
        label.text = `Open inventory: I
Mint item: M
Clear item selection: C
Save changes: U

Place item: Left Click
Rotate item: Q/E
Scale item: R/F
Get item: Right click
Remove item: Del`;
        label.textHorizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(label);

        return rect;
    }

    // TODO: do I even need this?
    private getInstanceRoot(node: Nullable<Node>): Nullable<Node> {
        let parent: Nullable<Node> = node;
        while(parent) {
            const metadata = parent.metadata as InstanceMetadata;
            if(metadata && metadata.itemTokenId) return parent;
            parent = parent.parent;
        }
        return null;
    }

    private getInstanceMetadata(node: Node): InstanceMetadata | null {
        const root = this.getInstanceRoot(node);
        if(root) return root.metadata as InstanceMetadata;
        return null;
    }

    public getCurrentItem(): Nullable<Node> {
        return this.getInstanceRoot(this.current_node);
    }

    // TODO: probably shouldnt be async.
    // instead we can keep the gui around and have an async function that updates it?
    // probably would be better. TEMP solution works for now.
    async updatePickingGui(node: Nullable<TransformNode>, distance: number) {
        if(node === this.current_node) return;

        this.current_node = node;

        if(this.infoGui) {
            // OLD
            //this.infoGui.dispose();
            //this.infoGui = null;

            // TEMP
            let control;
            while(control = this.advancedTexture.getControlByName("ItemInfo")) {
                control.dispose();
            };
            this.infoGui = null;
        }

        if(!this.current_node || distance > 20) return;

        const metadata = this.getInstanceMetadata(this.current_node);

        if(!metadata) return;

        const itemMetadata = await Metadata.getItemMetadata(metadata.itemTokenId.toNumber());
        
        var rect = new Rectangle("ItemInfo");
        rect.widthInPixels = 110;
        rect.heightInPixels = 110 * 3/4;
        rect.cornerRadius = 5;
        rect.thickness = 2;
        rect.color = "black";
        rect.background = "white";
        this.advancedTexture.addControl(rect);
        rect.linkWithMesh(node);
        rect.linkOffsetX = -200;

        var panel = new StackPanel();
        panel.width = 0.9;
        panel.height = 0.9;
        //panel.logLayoutCycleErrors = true; // TEMP*/
        rect.addControl(panel);

        const isSaved = metadata.id !== undefined;

        var label = new TextBlock();
        label.fontSize = "10px";
        label.height = "24px";
        label.width = 1;
        label.text = (isSaved ? "" : "*") + truncate(itemMetadata.name, 16, '\u2026');
        label.textHorizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_CENTER;
        label.textVerticalAlignment = StackPanel.VERTICAL_ALIGNMENT_TOP;
        panel.addControl(label);

        label = new TextBlock();
        label.fontSize = "8px";
        label.height = "16px";
        label.width = 1;
        label.text = `By: ${truncate(itemMetadata.token_info.minter, 16, '\u2026')}`;
        label.textHorizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(label);

        const forSale: boolean = isSaved && metadata.xtzPerItem !== 0;

        label = new TextBlock();
        label.fontSize = "8px";
        label.height = "10px";
        label.width = 1;
        label.text = !forSale && isSaved ? "" : `${metadata.itemAmount} Items - ${metadata.xtzPerItem === 0 ? "Not for sale" : metadata.xtzPerItem + " \uA729"}`;
        label.textHorizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(label);

        label = new TextBlock();
        label.fontSize = "8px";
        label.height = "32px";
        label.width = 1;
        label.text = !isSaved ? "Press U to save." : forSale ? "Right-click to get this item." : "Not for sale.";
        label.textHorizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(label);

        this.infoGui = rect;

        /*var target = new Ellipse();
        target.width = "40px";
        target.height = "40px";
        target.color = "Orange";
        target.thickness = 4;
        target.background = "green";
        this.advancedTexture.addControl(target);
        target.linkWithMesh(node);   

        var line = new Line();
        line.lineWidth = 4;
        line.color = "Orange";
        line.y2 = 20;
        line.linkOffsetY = -20;
        this.advancedTexture.addControl(line);
        line.linkWithMesh(node); 
        line.connectedControl = rect1;*/
        // GUI temp
    }
}