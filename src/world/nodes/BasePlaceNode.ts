import { Nullable } from '@babylonjs/core/types';
import { Mesh, MeshBuilder, TransformNode } from '@babylonjs/core/Meshes';
import { Color3, Vector3 } from '@babylonjs/core/Maths';
import { Material } from '@babylonjs/core/Materials';
import { BoundingBox } from '@babylonjs/core/Culling';
import earcut from 'earcut';
import BigNumber from "bignumber.js";
import Contracts from "../../tz/Contracts";
import { Logging } from "../../utils/Logging";
import { mutezToTez } from "../../utils/TezosUtils";
import Metadata, { PlaceTokenMetadata } from "../Metadata";
import { BaseWorld } from "../BaseWorld";
import ItemNode, { ItemLoadState } from "./ItemNode";
import { World } from "../World";
import ItemTracker from "../../controllers/ItemTracker";
import AppSettings from "../../storage/AppSettings";
import { SimpleMaterial } from "@babylonjs/materials";
import TokenKey from "../../utils/TokenKey";
import PlaceKey from "../../utils/PlaceKey";
import PlaceProperties from "../../utils/PlaceProperties";
import { MeshUtils } from "../../utils/MeshUtils";
import EventBus, { AddNotificationEvent } from "../../utils/eventbus/EventBus";
import { assert } from '../../utils/Assert';


export type PlaceItemData = {
    chunk_id: BigNumber;
    item_id: BigNumber;
    issuer: string | null;
    fa2: string;
    data: any;
}

export class PlaceSequenceNumbers {
    place_seq: string;
    chunk_seqs: Map<number, string>;

    constructor(place_seq: string, chunk_seqs: Map<number, string>) {
        this.place_seq = place_seq;
        this.chunk_seqs = chunk_seqs;
    }

    // NOTE: very basic comparison.
    public isEqual(other: PlaceSequenceNumbers): boolean {
        if (this.place_seq !== other.place_seq) return false;

        // TODO: will fail when chunks in array are in different order of don't have the same number of elements.
        if (this.chunk_seqs.size !== other.chunk_seqs.size) return false;

        for (const [key, seq] of this.chunk_seqs) {
            const other_seq = other.chunk_seqs.get(key);
            //if (!other_seq) return false;
            if(seq !== other_seq) return false;
        }

        return true;
    }
}

export type PlaceData = {
    tokenId: number;
    contract: string;
    placeType: string;
    storedItems: PlaceItemData[]; // TODO: could be map item_id => item_data?
    placeProps: Map<string, string>;
    placeSeq: PlaceSequenceNumbers;
    itemsTo: Nullable<string>;
    valueTo: Nullable<string>;
}

export class PlacePermissions {
    private _permissions: number;

    // should mirror the permissions from TL_World contract.
    public static permissionNone: number       = 0;
    public static permissionPlaceItems: number = 1;
    public static permissionModifyAll: number  = 2;
    public static permissionProps: number      = 4;
    public static permissionOwnerProps: number = 8;
    //public static permissionCanSell: number    = 16;
    public static permissionFull: number       = 15; // 31 with CanSell

    constructor(permissions: number) {
        this._permissions = permissions;
    }

    public get permissions(): number { return this._permissions; }

    public hasAny() { return this._permissions !== PlacePermissions.permissionNone; }
    public hasPlaceItems() { return (this._permissions & PlacePermissions.permissionPlaceItems) === PlacePermissions.permissionPlaceItems; }
    public hasModifyAll() { return (this._permissions & PlacePermissions.permissionModifyAll) === PlacePermissions.permissionModifyAll; }
    public hasProps() { return (this._permissions & PlacePermissions.permissionProps) === PlacePermissions.permissionProps; }
    public hasOwnerProps() { return (this._permissions & PlacePermissions.permissionOwnerProps) === PlacePermissions.permissionOwnerProps; }
    public hasFull() { return (this._permissions & PlacePermissions.permissionFull) === PlacePermissions.permissionFull; }

    public toString(): string {
        if (!this.hasAny()) return "None";
        if (this.hasFull()) return "Full";

        const res = [];
        if (this.hasPlaceItems()) res.push("PlaceItems");
        if (this.hasModifyAll()) res.push("ModifyAll");
        if (this.hasProps()) res.push("Props");
        if (this.hasOwnerProps()) res.push("OwnerProps");
        return res.join(", ");
    }
};

export default abstract class BasePlaceNode extends TransformNode {
    readonly placeKey: PlaceKey;
    readonly placeMetadata: PlaceTokenMetadata;
    readonly world: BaseWorld;

    protected _origin: Vector3;
    get origin(): Vector3 { return this._origin.clone(); }

    protected _buildHeight;
    get buildHeight(): number { return this._buildHeight; }

    get getPermissions(): PlacePermissions { return this.permissions; }
    get currentOwner(): string { return this.owner; }
    protected owner: string = "";
    protected permissions: PlacePermissions = new PlacePermissions(PlacePermissions.permissionNone);
    protected last_owner_and_permission_update = 0;

    public placeData: PlaceData | undefined;

    protected _placeBounds: Nullable<Mesh> = null;
    get placeBounds() { return this._placeBounds; }
    protected placeGround: Nullable<Mesh> = null;

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
    private items: Map<string, ItemNode> = new Map();

    // Number of out of bounds items in this place.
    public outOfBoundsItems: number = 0;

    constructor(placeKey: PlaceKey, placeMetadata: PlaceTokenMetadata, world: BaseWorld) {
        super(`placeRoot${placeKey.id}`, world.game.scene);

        this.world = world;

        this.placeKey = placeKey;
        this.placeMetadata = placeMetadata;

        this._origin = Vector3.FromArray(this.placeMetadata.centerCoordinates);
        this._buildHeight = this.placeMetadata.buildHeight;

        this.initialisePlace();
    }

    public override dispose(doNotRecurse?: boolean | undefined, disposeMaterialAndTextures?: boolean | undefined): void {
        // https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene#scene-with-large-number-of-meshes
        this.world.game.scene.blockfreeActiveMeshesAndRenderingGroups = true;

        this.items.clear();
        this.outOfBoundsItems = 0;

        // TODO: have some flag if it's loading right now or something.
        this._placeBounds?.dispose();
        this._placeBounds = null;

        this.placeGround?.dispose();
        this.placeGround = null;

        this._itemsNode?.dispose();
        this._itemsNode = null;

        this._tempItemsNode?.dispose();
        this._tempItemsNode = null;

        ItemTracker.removeTrackedItemsForPlace(this.placeKey.id);

        super.dispose(doNotRecurse, disposeMaterialAndTextures);

        this.world.game.scene.blockfreeActiveMeshesAndRenderingGroups = false;
    }

    // TODO: use MeshUtils.extrudeMeshFromShape
    private extrudeMeshFromShape(shape: Vector3[], depth: number, pos: Vector3, mat: Material): Mesh {
        const extrude = MeshBuilder.ExtrudePolygon(`bounds`, {
            shape: shape,
            depth: depth
        }, this.world.game.scene, earcut);

        extrude.material = mat;
        extrude.position = pos;
        extrude.isPickable = false;

        return extrude;
    }

    private polygonMeshFromShape(shape: Vector3[], pos: Vector3, mat: Material): Mesh {
        const poly = MeshBuilder.CreatePolygon(`ground`, {
            shape: shape
        }, this.world.game.scene, earcut);

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
        this.freezeWorldMatrix();

        // create bounds
        // TODO: use MeshUtils.extrudeMeshFromShape
        this._placeBounds = this.extrudeMeshFromShape(shape, this._buildHeight + 1, new Vector3(0, this._buildHeight, 0),
            this.world.game.transparentGridMat);

        this._placeBounds.visibility = +AppSettings.displayPlaceBounds.value;
        this._placeBounds.parent = this;
        // Call getHierarchyBoundingVectors to force updating the bounding info!
        // TODO: figure out if still needed.
        this._placeBounds.getHierarchyBoundingVectors();
        this._placeBounds.freezeWorldMatrix();

        // create ground
        this.placeGround = this.polygonMeshFromShape(shape, new Vector3(0, 0, 0),
            new SimpleMaterial(`placeGroundMat${this.placeKey.id}`, this.world.game.scene));
        this.placeGround.receiveShadows = true;
        this.placeGround.parent = this;
        this.placeGround.freezeWorldMatrix();

        // create items node
        this._itemsNode = new TransformNode(`items`, this.world.game.scene);
        this._itemsNode.position.y += this._buildHeight * 0.5; // center on build height for f16 precision
        this._itemsNode.parent = this;
        this._itemsNode.freezeWorldMatrix();

        // create temp items node
        this._tempItemsNode = new TransformNode(`itemsTemp`, this.world.game.scene);
        this._tempItemsNode.position.y += this._buildHeight * 0.5; // center on build height for f16 precision
        this._tempItemsNode.parent = this;
        this._tempItemsNode.freezeWorldMatrix();
    }

    public displayOutOfBoundsItemsNotification() {
        // TODO: add button to remove out of bounds items.
        // Display out of bounds notifications if there are any.
        if (this.outOfBoundsItems > 0 && (this.permissions.hasPlaceItems() || this.permissions.hasModifyAll())) {
            EventBus.publish("add-notification", new AddNotificationEvent({
                id: "oobItems" + this.placeKey.id,
                title: "Out of bounds items!",
                body: `Your Place #${this.placeKey.id} has out of bounds items!\n\nYou can remove them in the place properties panel.`,
                type: 'warning'
            }));
        }
    }

    // TODO: make sure it doesn't throw exception is potentially not caught.
    public async load() {
        assert(this._placeBounds && this.placeGround, "Place not initialised.");

        // First, load the palce data from disk.
        if (!this.placeData) this.placeData = await Metadata.Storage.loadObject("placeData", [this.placeKey.id, this.placeKey.fa2]);
        if (this.isDisposed()) return;

        // If we have place data, load the items.
        // TODO: maybe have another queue for this. loadingQueue.
        if (this.placeData) {
            this.updateOnPlacePropChange(new PlaceProperties(this.placeData.placeProps), true);
            this.loadItems();
        }

        // Queue and update - checking the seq number and possbily fetching updated items
        this.world.game.onchainQueue.add(() => this.update());
    }

    public async update(force: boolean = false, attempt: number = 1) {
        if (attempt > 5) {
            Logging.Warn("Too many failed attempts updating place. Giving up. Place id:", this.placeKey.id);
            return;
        }

        const first_load = this.placeData === undefined;

        try {
            // If not forced and we have place data...
            if (!force && this.placeData) {
                const newSeqNum = await Contracts.getPlaceSeqNum(this.world.game.walletProvider, this.placeKey);
                if (this.isDisposed()) return;

                // Check the sequence number.
                // Note: Call isEqual on the new one since the old is probably a plain object now.
                if (newSeqNum.isEqual(this.placeData.placeSeq)) {
                    //Logging.InfoDev("sequence number is identical, no update needed", this.placeKey.id);
                    return;
                }
            }

            // reload place data if it changed or we don't have any.
            this.placeData = await Contracts.getItemsForPlaceView(this.world.game.walletProvider, this.placeKey);
            if (this.isDisposed()) return;
        }
        // catch exceptions and queue another update.
        catch(e: any) {
            // Handle failiures to fetch updates. Queue again.
            Logging.InfoDev("Updating place failed", this.placeKey.id, e);
            setTimeout(() => this.world.game.onchainQueue.add(() => this.update(force, attempt + 1)), 1000);
            return;
        }

        // If successful, load Items. Don't await, this should run outside the queue.
        // TODO: maybe have another queue for this. loadingQueue.
        this.updateOnPlacePropChange(new PlaceProperties(this.placeData!.placeProps), first_load);
        this.loadItems();
    }

    // TODO: be smarter about loading items. don't reload everthing, maybe.
    private loadItems() {
        try {
            // Load place gound, items, etc.
            assert(this.placeData);
            assert(this.placeGround);
            assert(this.placeGround.material instanceof SimpleMaterial);
            this.placeGround.material.diffuseColor = Color3.FromHexString(`#${this.placeData.placeProps.get('00')}`);

            // The new item map.
            // We add new additions and move existing items to this one.
            const newItems: Map<string, ItemNode> = new Map();

            //items.forEach(async (element: any) => {
            for (const element of this.placeData.storedItems) {
                if(!element.data.item) continue;

                // Set prototype to make sure BigNumbers get recognised.
                // See here: https://github.com/MikeMcl/bignumber.js/issues/245
                Object.setPrototypeOf(element.chunk_id, BigNumber.prototype);
                Object.setPrototypeOf(element.item_id, BigNumber.prototype);
                Object.setPrototypeOf(element.data.item.token_id, BigNumber.prototype);
                Object.setPrototypeOf(element.data.item.rate, BigNumber.prototype);
                Object.setPrototypeOf(element.data.item.amount, BigNumber.prototype);

                const fa2 = element.fa2;
                const issuer = element.issuer;
                const chunk_id = new BigNumber(element.chunk_id);
                const chunk_id_num = chunk_id.toNumber();
                const item_id = new BigNumber(element.item_id);
                const item_id_num = item_id.toNumber();
                const token_id = new BigNumber(element.data.item.token_id);
                const token_amount = new BigNumber(element.data.item.amount);
                const xtz_per_token = mutezToTez(element.data.item.rate).toNumber();
                const item_data = element.data.item.data;
                const is_primary = element.data.item.primary;

                const item_map_key = `${chunk_id_num}.${item_id_num}`;
                const existing_item = this.items.get(item_map_key);
                // TEMP: currently items are disposed if the boundcheck fails.
                // If they aren't disposed they should be attempted to be loaded again.
                if (existing_item && !existing_item.isDisposed()) {
                    existing_item.updateFromData(item_data);
                    existing_item.itemAmount = token_amount;

                    // TODO: bounds check again.

                    // add to new items, remove from old items.
                    newItems.set(item_map_key, existing_item);
                    this.items.delete(item_map_key);
                }
                else {
                    try {
                        const itemNode = ItemNode.CreateItemNode(this, new TokenKey(token_id, fa2), this.world.game.scene, this._itemsNode);
                        itemNode.updateFromData(item_data);

                        // Set issuer, etc.
                        itemNode.chunkId = chunk_id;
                        itemNode.itemId = item_id;
                        itemNode.issuer = issuer;
                        itemNode.placeOwned = issuer === null;
                        itemNode.primarySwap = is_primary;
                        itemNode.itemAmount = token_amount;
                        itemNode.xtzPerItem = xtz_per_token;

                        newItems.set(item_map_key, itemNode);
                    }
                    catch(e) {
                        Logging.InfoDev("Failed to load placed item", this.placeKey.id, token_id.toNumber(), e);
                    }
                }
            };

            // Everything left in the old items can be disposed now.
            this.items.forEach((n) => n.dispose());
            this.items.clear();

            // Assign new items.
            this.items = newItems;

            // Remove cached texture buffers, we don't need them.
            this.world.game.scene.cleanCachedTextureBuffer();
            //this.octree = this.scene.createOrUpdateSelectionOctree();

            this.updateLOD();
        }
        catch(e: any) {
            Logging.Error("Failed to load items for place " + this.placeKey.id, e);
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
            Logging.InfoDev("can't save: items not loaded", this.placeKey.id);
            return false;
        }

        if(this.savePending) {
            Logging.Info("Can't save again while operaton is pending", this.placeKey.id);
            return false;
        }

        // try to save items.
        const tempChildren = this._tempItemsNode.getChildren();
        const add_children = new Array<ItemNode>();

        tempChildren.forEach((child) => {
            assert(child instanceof ItemNode);
            assert(child.itemId.lt(0));
            // Only save valid tokens, not imported models.
            if (child.isValidItem()) add_children.push(child);
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
            Logging.InfoDev("Nothing to save", this.placeKey.id);
            return false;
        }

        this.savePending = true;

        // NOTE: when saving goes wrong (item limits, whatever),
        // it still exits pointer lock in PlayerController.
        Contracts.saveItems(this.world.game.walletProvider, remove_children, add_children, this, (completed: boolean) => {
            this.savePending = false;

            // Only remove temp items if op completed.
            if(completed) {
                this.clearTempItems();
                ItemTracker.removeTrackedItemsForPlace(this.placeKey.id);
            }
        }).catch(e => {
            EventBus.publish("add-notification", new AddNotificationEvent({
                id: "saveFailed" + this.placeKey.id,
                title: "Saving items failed!",
                body: `Saving items in place #${this.placeKey.id} failed:\n\n${e.message}`,
                type: 'danger'
            }));
            Logging.ErrorDev(e);
            this.savePending = false;
        });

        return true;
    }

    public isInBounds(object: ItemNode) {
        if(!this._placeBounds) return false;
        // NOTE: boundingVectors === 0 should be an error?

        const {min, max} = object.boundingVectors;
        const bbox = new BoundingBox(min, max, object.getWorldMatrix());

        // TODO: get points from OBB
        // for some reason passing world matrix to BoundingBox constructor doesn't have the desired effect....
        for(var i = 0; i < bbox.vectorsWorld.length; ++i) {
            const p = bbox.vectorsWorld[i];

            if(!MeshUtils.pointIsInside(p, this._placeBounds))
                return false;
        }

        return true;
    }

    public abstract getName(): string;

    private clearTempItems() {
        if(this._tempItemsNode) {
            this._tempItemsNode.dispose();
            this._tempItemsNode = null;
            Logging.InfoDev("cleared temp items", this.placeKey.id);
        }

        // create NEW temp items node
        this._tempItemsNode = new TransformNode(`placeTemp${this.placeKey.id}`, this.world.game.scene);
        this._tempItemsNode.position.y += this._buildHeight * 0.5; // center on build height for f16 precision
        this._tempItemsNode.parent = this;
        this._tempItemsNode.freezeWorldMatrix();
    }

    /**
     * Updates the place owner and permissions.
     * @param force force update, ignoring validity.
     * @param validity validity of information in seconds.
     */
     public async updateOwnerAndPermissions(force: boolean = false, validity: number = 60) {
        // Update owner and permissions, if they weren't updated recently.
        // TODO: the rate limiting here is a bit wonky - it breaks when there was an error fetching the owner.
        // Maybe reset last_owner_and_permission_update on failiure?
        if(force || (Date.now() - (validity * 1000)) > this.last_owner_and_permission_update) {
            const prev_update = this.last_owner_and_permission_update;
            Logging.InfoDev("Updating owner and permissions for place " + this.placeKey.id);
            try {
                this.last_owner_and_permission_update = Date.now();
                this.owner = await Contracts.getPlaceOwner(this.placeKey);
                this.permissions = await Contracts.getPlacePermissions(this.world.game.walletProvider, this.placeKey, this.owner);
            }
            catch(reason: any) {
                this.last_owner_and_permission_update = prev_update;
                Logging.InfoDev("failed to load permissions/ownership " + this.placeKey.id);
                Logging.InfoDev(reason);
            }
        }
    }

    public abstract updateOnPlacePropChange(props: PlaceProperties, first_load: boolean): void;
}