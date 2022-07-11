import { BoundingBox, Mesh, MeshBuilder, Nullable,
    TransformNode, Vector3, Color3, Material } from "@babylonjs/core";

import earcut from 'earcut';

import Contracts from "../tz/Contracts";
import { mutezToTez, pointIsInside } from "../utils/Utils";
import { World } from "./World";
import { SimpleMaterial } from "@babylonjs/materials";
import { Logging } from "../utils/Logging";
import BigNumber from "bignumber.js";
import AppSettings from "../storage/AppSettings";
import assert from "assert";
import Metadata, { StorageKey } from "./Metadata";
import { bytes2Char } from "@taquito/utils";
import ItemNode, { ItemLoadState } from "./ItemNode";
import ItemTracker from "../controllers/ItemTracker";
import BasePlaceNode from "./nodes/BasePlaceNode";


export type PlaceItemData = {
    item_id: BigNumber;
    issuer: string;
    data: any;
}

export type PlaceData = {
    stored_items: PlaceItemData[];
    place_props: Map<string, string>;
    place_seq: string;
}


export default class PlaceNode extends BasePlaceNode {
    public placeData: Nullable<PlaceData> = null;

    private placeBounds: Nullable<Mesh> = null;
    private placeGround: Nullable<Mesh> = null;

    //private executionAction: Nullable<ExecuteCodeAction> = null;

    // All saved items are stored in this.
    private _itemsNode: Nullable<TransformNode> = null;
    get itemsNode() { return this._itemsNode; }
    private set itemsNode(val: Nullable<TransformNode>) { this._itemsNode = val; }

    // Unsaved items are stored in here.
    // TODO: this really is a crutch. should be smarter about clearing items.
    private _tempItemsNode: Nullable<TransformNode> = null;
    get tempItemsNode() { return this._tempItemsNode; }
    private set tempItemsNode(val: Nullable<TransformNode>) { this._tempItemsNode = val; }

    private savePending: boolean = false;

    // The items loaded in this place.
    private items: Map<number, ItemNode> = new Map();

    // Set of out of bounds items in this place.
    public outOfBoundsItems: Set<number> = new Set();

    constructor(placeId: number, placeMetadata: any, world: World) {
        super(placeId, placeMetadata, world);

        this.initialisePlace();
    }

    public override dispose() {
        // TODO: have some flag if it's loading right now or something.
        this.placeBounds?.dispose();
        this.placeBounds = null;

        this.placeGround?.dispose();
        this.placeGround = null;

        this._itemsNode?.dispose();
        this._itemsNode = null;

        this._tempItemsNode?.dispose();
        this._tempItemsNode = null;

        this.items.clear();
        this.outOfBoundsItems.clear();

        // TODO: surely it's enough to remove the place root.

        // unregister execution action
        //if (this.executionAction && this.world.playerController.playerTrigger.actionManager) {
        //    this.world.playerController.playerTrigger.actionManager.unregisterAction(this.executionAction);
        //}

        ItemTracker.removeTrackedItemsForPlace(this.placeId);

        super.dispose();
    }

    // TODO: use MeshUtils.extrudeMeshFromShape
    private extrudeMeshFromShape(shape: Vector3[], depth: number, pos: Vector3, mat: Material): Mesh {
        const extrude = MeshBuilder.ExtrudePolygon(`bounds`, {
            shape: shape,
            depth: depth
        }, this.world.scene, earcut);

        extrude.material = mat;
        extrude.position = pos;
        extrude.isPickable = false;

        return extrude;
    }

    private polygonMeshFromShape(shape: Vector3[], pos: Vector3, mat: Material): Mesh {
        const poly = MeshBuilder.CreatePolygon(`ground`, {
            shape: shape
        }, this.world.scene, earcut);

        poly.material = mat;
        poly.position = pos;
        poly.isPickable = false;

        return poly;
    }

    private initialisePlace() {
        var shape = new Array<Vector3>();
        this.placeMetadata.borderCoordinates.forEach((v: Array<number>) => {
            shape.push(Vector3.FromArray(v));
        });

        // TODO: make sure the place coordinates are going right around!
        shape = shape.reverse();

        this.position.copyFrom(this._origin); // TODO: move to base constructor?

        // create bounds
        // TODO: use MeshUtils.extrudeMeshFromShape
        this.placeBounds = this.extrudeMeshFromShape(shape, this._buildHeight + 1, new Vector3(0, this._buildHeight, 0),
            (this.world as World).transparentGridMat);

        this.placeBounds.visibility = +AppSettings.displayPlaceBounds.value;
        this.placeBounds.parent = this;
        // Call getHierarchyBoundingVectors to force updating the bounding info!
        // TODO: figure out if still needed.
        this.placeBounds.getHierarchyBoundingVectors();
        this.placeBounds.freezeWorldMatrix();

        // create ground
        this.placeGround = this.polygonMeshFromShape(shape, new Vector3(0, 0, 0),
            new SimpleMaterial(`placeGroundMat${this.placeId}`, this.world.scene));
        this.placeGround.receiveShadows = true;
        this.placeGround.parent = this;
        this.placeGround.freezeWorldMatrix();

        // create items node
        this._itemsNode = new TransformNode(`items`, this.world.scene);
        this._itemsNode.position.y += this._buildHeight * 0.5; // center on build height for f16 precision
        this._itemsNode.parent = this;

        // create temp items node
        this._tempItemsNode = new TransformNode(`itemsTemp`, this.world.scene);
        this._tempItemsNode.position.y += this._buildHeight * 0.5; // center on build height for f16 precision
        this._tempItemsNode.parent = this;

        // NOTE: mesh to mesh intersection is only checking bounding boxes.
        // Rather use a pick trigger and work out if inside or outside.
        // Maybe do it manually.
        /*this.executionAction = new ExecuteCodeAction(
            {
                trigger: ActionManager.OnIntersectionEnterTrigger,
                parameter: {
                    mesh: this.placeBounds,
                    usePreciseIntersection: true
                }
            },
            async () => {
                await this.updateOwnerAndPermissions();

                // Then set current place. Updates the UI as well.
                this.world.playerController.setCurrentPlace(this);
                Logging.InfoDev("entered place: " + this.placeId);

                this.displayOutOfBoundsItemsNotification();
            },
        );*/

        // register player trigger when place owner info has loaded.
        //assert(this.world.playerController.playerTrigger.actionManager, "action manager doesn't exist");
        //this.world.playerController.playerTrigger.actionManager.registerAction(this.executionAction);
    }

    public displayOutOfBoundsItemsNotification() {
        // TODO: add button to remove out of bounds items.
        // Display out of bounds notifications if there are any.
        if (this.outOfBoundsItems.size > 0 && this.permissions.hasPlaceItems()) {
            const itemList = Array.from(this.outOfBoundsItems).join(', ');
            (this.world as World).appControlFunctions.addNotification({
                id: "oobItems" + this.placeId,
                title: "Out of bounds items!",
                body: `Your Place #${this.placeId} has out of bounds items!\n\nItem ids (in Place): ${itemList}.\n\nYou can remove them using better-call.dev.\nFor now.`,
                type: 'warning'
            })
            Logging.Warn("place doesn't fully contain objects: " + itemList);
        }
    }

    // TODO: make sure it doesn't throw exception is potentially not caught.
    public async load() {
        assert(this.placeBounds && this.placeGround, "Place not initialised.");

        // First, load the palce data from disk.
        if (!this.placeData) this.placeData = await Metadata.Storage.loadObject(this.placeId, StorageKey.PlaceItems);
        if (this.isDisposed()) return;

        // If we have place data, load the items.
        // TODO: maybe have another queue for this. loadingQueue.
        if (this.placeData) this.loadItems();

        // Queue and update - checking the seq number and possbily fetching updated items
        (this.world as World).onchainQueue.add(() => this.update());
    }

    public async update(force: boolean = false, attempt: number = 1) {
        if (attempt > 5) {
            Logging.Warn("Too many failed attempts updating place. Giving up. Place id:", this.placeId);
            return;
        }

        try {
            // If not forced and we have place data...
            if (!force && this.placeData) {
                const newSeqNum = await Contracts.getPlaceSeqNum(this.world.walletProvider, this.placeId);
                if (this.isDisposed()) return;

                // Check the sequence number.
                if (this.placeData.place_seq === newSeqNum) {
                    //Logging.InfoDev("sequence number is identical, no update needed", this.placeId);
                    return;
                }
            }

            // reload place data if it changed or we don't have any.
            this.placeData = await Contracts.getItemsForPlaceView(this.world.walletProvider, this.placeId);
            if (this.isDisposed()) return;
        }
        // catch exceptions and queue another update.
        catch(e: any) {
            // Handle failiures to fetch updates. Queue again.
            Logging.InfoDev("Updating place failed", this.placeId, e);
            setTimeout(() => (this.world as World).onchainQueue.add(() => this.update(force, attempt + 1)), 1000);
            return;
        }

        // If successful, load Items. Don't await, this should run outside the queue.
        // TODO: maybe have another queue for this. loadingQueue.
        this.loadItems();
    }

    // TODO: be smarter about loading items. don't reload everthing, maybe.
    private loadItems() {
        try {
            // Load place gound, items, etc.
            assert(this.placeData);
            assert(this.placeGround);
            assert(this.placeGround.material instanceof SimpleMaterial);
            this.placeGround.material.diffuseColor = Color3.FromHexString(`#${this.placeData.place_props.get('00')}`);

            // The new item map.
            // We add new additions and move existing items to this one.
            const newItems: Map<number, ItemNode> = new Map();

            //items.forEach(async (element: any) => {
            for (const element of this.placeData.stored_items) {
                if(!element.data.item) continue;

                // Set prototype to make sure BigNumbers get recognised.
                // See here: https://github.com/MikeMcl/bignumber.js/issues/245
                Object.setPrototypeOf(element.item_id, BigNumber.prototype);
                Object.setPrototypeOf(element.data.item.token_id, BigNumber.prototype);
                Object.setPrototypeOf(element.data.item.mutez_per_item, BigNumber.prototype);
                Object.setPrototypeOf(element.data.item.item_amount, BigNumber.prototype);

                const issuer = element.issuer;
                const item_id = new BigNumber(element.item_id);
                const item_id_num = item_id.toNumber();
                const token_id = new BigNumber(element.data.item.token_id);
                const item_amount = new BigNumber(element.data.item.item_amount);
                const xtz_per_item = mutezToTez(element.data.item.mutez_per_item).toNumber();
                const item_data = element.data.item.item_data;

                const existing_item = this.items.get(item_id_num);
                // TEMP: currently items are disposed if the boundcheck fails.
                // If they aren't disposed they should be attempted to be loaded again.
                if (existing_item && !existing_item.isDisposed()) {
                    existing_item.updateFromData(item_data);
                    existing_item.itemAmount = item_amount;

                    // TODO: bounds check again.

                    // add to new items, remove from old items.
                    newItems.set(item_id_num, existing_item);
                    this.items.delete(item_id_num);
                }
                else {
                    try {
                        const itemNode = ItemNode.CreateItemNode(this.placeId, token_id, this.world.scene, this._itemsNode);
                        itemNode.updateFromData(item_data);

                        // Set issuer, etc.
                        itemNode.itemId = item_id;
                        itemNode.issuer = issuer;
                        itemNode.itemAmount = item_amount;
                        itemNode.xtzPerItem = xtz_per_item;

                        newItems.set(item_id_num, itemNode);
                    }
                    catch(e) {
                        Logging.InfoDev("Failed to load placed item", this.placeId, token_id.toNumber(), e);
                    }
                }
            };

            // Everything left in the old items can be disposed now.
            this.items.forEach((n) => n.dispose());
            this.items.clear();

            // Assign new items.
            this.items = newItems;

            // Remove cached texture buffers, we don't need them.
            this.world.scene.cleanCachedTextureBuffer();
            //this.octree = this.scene.createOrUpdateSelectionOctree();

            this.updateLOD();
        }
        catch(e: any) {
            Logging.Error("Failed to load items for place " + this.placeId, e);
        }
    }

    public updateLOD() {
        assert(this._scene.activeCamera);
        const pos = this._scene.activeCamera.globalPosition;
        this.items.forEach(item => {
            // Update enabled state based on LOD.
            const newEnabled = item.updateLOD(pos);

            // If item is enabled and not loaded, queue item load.
            if (newEnabled && item.loadState === ItemLoadState.NotLoaded) {
                item.queueLoadItemTask(this.world as World, this);
            }
        })
    }

    public save(): boolean {
        if(!this._tempItemsNode || !this._itemsNode) {
            Logging.InfoDev("can't save: items not loaded", this.placeId);
            return false;
        }

        if(this.savePending) {
            Logging.Info("Can't save again while operaton is pending", this.placeId);
            return false;
        }

        // try to save items.
        const tempChildren = this._tempItemsNode.getChildren();
        const add_children = new Array<ItemNode>();

        tempChildren.forEach((child) => {
            assert(child instanceof ItemNode);
            assert(child.itemId.lt(0));
            add_children.push(child);
        });

        const children = this._itemsNode.getChildren();
        const remove_children = new Array<ItemNode>();

        children.forEach((child) => {
            assert(child instanceof ItemNode);
            if(child.markForRemoval === true) {
                remove_children.push(child);
            }
        });

        if (add_children.length === 0 && remove_children.length === 0) {
            // TODO: probably should throw exceptions here.
            Logging.InfoDev("Nothing to save", this.placeId);
            return false;
        }

        this.savePending = true;

        Contracts.saveItems(this.world.walletProvider, remove_children, add_children, this.placeId, this.owner, (completed: boolean) => {
            this.savePending = false;

            // Only remove temp items if op completed.
            if(completed) {
                this.clearTempItems();
                ItemTracker.removeTrackedItemsForPlace(this.placeId);
            }
        });

        return true;
    }

    public isInBounds(object: ItemNode) {
        if(!this.placeBounds) return false;
        if(!object.boundingVectors) return false;

        const {min, max} = object.boundingVectors;
        const bbox = new BoundingBox(min, max, object.getWorldMatrix());

        // TODO: get points from OBB
        // for some reason passing world matrix to BoundingBox constructor doesn't have the desired effect....
        for(var i = 0; i < bbox.vectorsWorld.length; ++i) {
            const p = bbox.vectorsWorld[i];

            if(!pointIsInside(p, this.placeBounds))
                return false;
        }

        return true;
    }

    public getName() {
        if (this.placeData) {
            const place_name = this.placeData.place_props.get('01');
            if (place_name) return bytes2Char(place_name);
        }

        return `Place #${this.placeId}`;
    }

    private clearTempItems() {
        if(this._tempItemsNode) {
            this._tempItemsNode.dispose();
            this._tempItemsNode = null;
            Logging.InfoDev("cleared temp items", this.placeId);
        }

        // create NEW temp items node
        this._tempItemsNode = new TransformNode(`placeTemp${this.placeId}`, this.world.scene);
        this._tempItemsNode.position.y += this._buildHeight * 0.5; // center on build height for f16 precision
        this._tempItemsNode.parent = this;
    }
}