import { BoundingBox, Mesh, MeshBuilder, Nullable, Node,
    TransformNode, Vector3, ExecuteCodeAction, ActionManager, Color3, Material } from "@babylonjs/core";

import earcut from 'earcut';

import Contracts from "../tz/Contracts";
import { mutezToTez, pointIsInside, yesNo } from "../utils/Utils";
import { World } from "./World";
import { SimpleMaterial } from "@babylonjs/materials";
import { Logging } from "../utils/Logging";
import BigNumber from "bignumber.js";
import AppSettings from "../storage/AppSettings";
import assert from "assert";
import Metadata, { StorageKey } from "./Metadata";
import { bytes2Char } from "@taquito/utils";
import ItemNode from "./ItemNode";


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

export type PlaceId = number;


export class PlacePermissions {
    private _permissions: number;

    // should mirror the permissions from TL_World contract.
    public static permissionNone: number       = 0;
    public static permissionPlaceItems: number = 1;
    public static permissionModifyAll: number  = 2;
    public static permissionProps: number      = 4;
    //public static permissionCanSell: number    = 8;
    public static permissionFull: number       = 7; // 15 with CanSell

    constructor(permissions: number) {
        this._permissions = permissions;
    }

    public get permissions(): number { return this._permissions; }

    public hasAny() { return this._permissions !== PlacePermissions.permissionNone; }
    public hasPlaceItems() { return (this._permissions & PlacePermissions.permissionPlaceItems) === PlacePermissions.permissionPlaceItems; }
    public hasModifyAll() { return (this._permissions & PlacePermissions.permissionModifyAll) === PlacePermissions.permissionModifyAll; }
    public hasProps() { return (this._permissions & PlacePermissions.permissionProps) === PlacePermissions.permissionProps; }
    public hasFull() { return (this._permissions & PlacePermissions.permissionFull) === PlacePermissions.permissionFull; }

    public toString(): string {
        if (!this.hasAny()) return "None";
        if (this.hasFull()) return "Full";

        return `PlaceItems:${yesNo(this.hasPlaceItems())}, ModifyAll:${yesNo(this.hasModifyAll())}, Props:${yesNo(this.hasProps())}`;
    }
};


export default class PlaceNode extends TransformNode {
    readonly placeId: number;
    readonly placeMetadata: any;
    public placeData: Nullable<PlaceData> = null;
    private world: World;

    private placeBounds: Nullable<Mesh> = null;
    private placeGround: Nullable<Mesh> = null;

    private executionAction: Nullable<ExecuteCodeAction> = null;

    private _origin: Vector3 = new Vector3();
    get origin(): Vector3 { return this._origin.clone(); }

    private _buildHeight: number = 0;
    get buildHeight(): number { return this._buildHeight; }

    // All saved items are stored in this.
    private _itemsNode: Nullable<TransformNode> = null;
    get itemsNode() { return this._itemsNode; }
    private set itemsNode(val: Nullable<TransformNode>) { this._itemsNode = val; }

    // Unsaved items are stored in here.
    // TODO: this really is a crutch. should be smarter about clearing items.
    private _tempItemsNode: Nullable<TransformNode> = null;
    get tempItemsNode() { return this._tempItemsNode; }
    private set tempItemsNode(val: Nullable<TransformNode>) { this._tempItemsNode = val; }

    get getPermissions(): PlacePermissions { return this.permissions; }
    get currentOwner(): string { return this.owner; }
    private owner: string = "";
    private permissions: PlacePermissions = new PlacePermissions(PlacePermissions.permissionNone);
    private last_owner_and_permission_update = 0;

    private savePending: boolean = false;

    // The items loaded in this place.
    private items: Map<number, ItemNode> = new Map();

    // Set of out of bounds items in this place.
    public outOfBoundsItems: Set<number> = new Set();

    constructor(placeId: number, placeMetadata: any, world: World) {
        super(`placeRoot${placeId}`, world.scene);

        this.placeId = placeId;
        this.placeMetadata = placeMetadata;
        this.world = world;

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
        if (this.executionAction && this.world.playerController.playerTrigger.actionManager) {
            this.world.playerController.playerTrigger.actionManager.unregisterAction(this.executionAction);
        }

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
        // Using ExtrudePolygon
        this._origin = Vector3.FromArray(this.placeMetadata.centerCoordinates);
        this._buildHeight = this.placeMetadata.buildHeight;

        var shape = new Array<Vector3>();
        this.placeMetadata.borderCoordinates.forEach((v: Array<number>) => {
            shape.push(Vector3.FromArray(v));
        });

        // TODO: make sure the place coordinates are going right around!
        shape = shape.reverse();

        this.position.copyFrom(this._origin);

        // create bounds
        // TODO: use MeshUtils.extrudeMeshFromShape
        this.placeBounds = this.extrudeMeshFromShape(shape, this._buildHeight + 1, new Vector3(0, this._buildHeight, 0),
            this.world.transparentGridMat);

        this.placeBounds.visibility = +AppSettings.displayPlaceBounds.value;
        this.placeBounds.parent = this;
        // Call getHierarchyBoundingVectors to force updating the bounding info!
        this.placeBounds.getHierarchyBoundingVectors();

        // create ground
        this.placeGround = this.polygonMeshFromShape(shape, new Vector3(0, 0, 0),
            new SimpleMaterial(`placeGroundMat${this.placeId}`, this.world.scene));
        this.placeGround.receiveShadows = true;
        this.placeGround.parent = this;

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
        this.executionAction = new ExecuteCodeAction(
            {
                trigger: ActionManager.OnIntersectionEnterTrigger,
                parameter: {
                    mesh: this.placeBounds,
                    usePreciseIntersection: true
                }
            },
            async () => {
                // Update owner and permissions, if they weren't updated recently.
                if(Date.now() - 60000 > this.last_owner_and_permission_update) {
                    Logging.InfoDev("Updating owner and permissions for place " + this.placeId);
                    try {
                        this.owner = await Contracts.getPlaceOwner(this.placeId);
                        this.permissions = await Contracts.getPlacePermissions(this.world.walletProvider, this.placeId, this.owner);
                        this.last_owner_and_permission_update = Date.now();
                    }
                    catch(reason: any) {
                        Logging.InfoDev("failed to load permissions/ownership " + this.placeId);
                        Logging.InfoDev(reason);
                    }
                }

                // Then set current place. Updates the UI as well.
                this.world.playerController.setCurrentPlace(this);
                Logging.InfoDev("entered place: " + this.placeId);

                // Display out of bounds notifications if there are any.
                if (this.outOfBoundsItems.size > 0 && this.permissions.hasFull()) {
                    const itemList = Array.from(this.outOfBoundsItems).join(', ');
                    this.world.appControlFunctions.addNotification({
                        id: "oobItems" + this.placeId,
                        title: "Out of bounds items!",
                        body: `Your Place #${this.placeId} has out of bounds items!\n\nItem ids (in Place): ${itemList}.\n\nYou can remove them using better-call.dev.\nFor now.`,
                        type: 'warning'
                    })
                    Logging.Warn("place doesn't fully contain objects: " + itemList);
                }
            },
        );

        // register player trigger when place owner info has loaded.
        assert(this.world.playerController.playerTrigger.actionManager, "action manager doesn't exist");
        this.world.playerController.playerTrigger.actionManager.registerAction(this.executionAction);
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
        this.world.onchainQueue.add(() => this.update());
    }

    public async update(force: boolean = false) {
        try {
            // catch exceptions and queue another update.
            const newSeqNum = await Contracts.getPlaceSeqNum(this.world.walletProvider, this.placeId);
            if (this.isDisposed()) return;
            const updateNeeded = force || !this.placeData || this.placeData.place_seq !== newSeqNum;

            // If the palce data doesn't need to be updated, return.
            if(!updateNeeded) return;

            // reload place data if it changed or we don't have any.
            this.placeData = await Contracts.getItemsForPlaceView(this.world.walletProvider, this.placeId, newSeqNum);
            if (this.isDisposed()) return;
        }
        catch(e: any) {
            // Handle failiures to fetch updates. Queue again.
            Logging.InfoDev("Updating place failed", this.placeId, e);
            this.world.onchainQueue.add(() => this.update());
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

                        itemNode.queueLoadItemTask(this.world, this);

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
        }
        catch(e: any) {
            Logging.Error("Failed to load items for place " + this.placeId, e);
        }
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
            }
        });

        return true;
    }

    public isInBounds(object: Node) {
        if(!this.placeBounds) return false;

        const {min, max} = object.getHierarchyBoundingVectors(true);
        const bbox = new BoundingBox(min, max);

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