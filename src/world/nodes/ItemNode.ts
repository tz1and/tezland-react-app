import { Nullable, Scene, Node, TransformNode, DeepImmutable, Vector3,
    MeshBuilder, BoundingBox, Matrix, Color3 } from "@babylonjs/core";
import { SimpleMaterial } from "@babylonjs/materials";
import BigNumber from "bignumber.js";
import ArtifactMemCache from "../../utils/ArtifactMemCache";
import { hasFlag, ItemDataFlags, ItemDataParser, TeleporterData } from "../../utils/ItemData";
import { Logging } from "../../utils/Logging";
import { BaseWorld } from "../BaseWorld";
import { World } from "../World";
import { triHelper, Trilean } from "../../forms/FormUtils";
import BasePlaceNode from "./BasePlaceNode";
import assert from "assert";
import TokenKey from "../../utils/TokenKey";
import { BoundingVectors } from "../BabylonUtils";


const LoadItemTask = (item: ItemNode, place: BasePlaceNode) => {
    return async () => {
        if (item.isDisposed()) return;

        await item.loadItem();

        if (place.isDisposed()) {
            item.dispose();
            return;
        }

        // TODO: isInBounds fails if artifact failed to load for some reason (limits or whatever)
        if (!place.isInBounds(item)) {
            Logging.WarnDev(`place #${place.placeKey.id} doesn't fully contain item with id`, item.itemId.toNumber());

            // TODO: show this if you are the owner instead of disposing.
            //item.setDisplayBounds(true, 0);

            // Add to out of bounds items to be displayed when owner enters.
            place.outOfBoundsItems.add(item.itemId.toNumber());

            // Dispose item.
            // TODO: Probably better to hide/disable items.
            // So they can eventually be shown to the owner for removal.
            item.dispose();
            return;
        }

        // Freeze wold matrix.
        item.getChildMeshes(false).forEach((e) => e.freezeWorldMatrix());
        item.freezeWorldMatrix();
    }
}


export const enum ItemLoadState {
    NotLoaded = 0,
    Queued = 1,
    Loaded = 2,
    Failed = 3
}


export default class ItemNode extends TransformNode {
    private place_or_world: BasePlaceNode | BaseWorld; // The place the item belongs to
    readonly tokenKey: TokenKey; // The token this item represents
    public chunkId: BigNumber; // The chunk this item is in
    public itemId: BigNumber; // The id of the item within the place
    public issuer: Nullable<string>; // The address that placed this item
    public xtzPerItem: number; // The price of the item
    public itemAmount: BigNumber; // The number of items
    public placeOwned: boolean; // If the place owns this item.
    public primarySwap: boolean; // If this is a primary swap.
    public markForRemoval: boolean; // If the item should be removed

    private _loadState: ItemLoadState;
    public get loadState(): ItemLoadState { return this._loadState; }

    private _recieveShadows: boolean;
    public get recieveShadows() { return this._recieveShadows; }
    public set recieveShadows(val: boolean) {
        // if changed, disable/enable collisions
        if (this._recieveShadows !== val) {
            this._recieveShadows = val;
            /*// disable/enabled recieve shadows on all sub-meshes
            this.getChildMeshes().forEach((m) => {
                // Instanced meshes don't have a setter.
                const descriptor = Object.getOwnPropertyDescriptor(m, 'receiveShadows');
                if (descriptor && descriptor.writable)
                    m.receiveShadows = this._recieveShadows;
            })*/
        }
    }

    private _disableCollision: boolean;
    public get disableCollision() { return this._disableCollision; }
    public set disableCollision(val: boolean) {
        // if changed, disable/enable collisions
        if (this._disableCollision !== val) {
            this._disableCollision = val;
            // disable/enabled collision on all sub-meshes
            this.getChildMeshes().forEach((m) => { m.checkCollisions = !this._disableCollision; })
        }
    }

    public teleporterData: Nullable<TeleporterData>;

    public boundingVectors: BoundingVectors;

    constructor(place_or_world: BasePlaceNode | BaseWorld, tokenKey: TokenKey,
        name: string, scene?: Nullable<Scene>, isPure?: boolean) {
        super(name, scene, isPure);

        this.place_or_world = place_or_world;
        this.tokenKey = tokenKey;
        this.chunkId = new BigNumber(-1);
        this.itemId = new BigNumber(-1);
        this.issuer = null;
        this.xtzPerItem = 0;
        this.itemAmount = new BigNumber(0);
        this.placeOwned = false;
        this.primarySwap = false;
        this.markForRemoval = false;

        this._disableCollision = false;
        this._recieveShadows = false;
        this.teleporterData = null;

        this._loadState = ItemLoadState.NotLoaded;

        this.boundingVectors = {
            min: Vector3.Zero(),
            max: Vector3.Zero()
        };
    }

    // TODO: needs some custom stuff for displying in inspector.
    /*public override getClassName(): string {
        return "ItemNode";
    }*/

    public override dispose(doNotRecurse?: boolean | undefined, disposeMaterialAndTextures?: boolean | undefined): void {
        if (!this.isDisposed()) {
            // Only decrease refcount if item wasn't already disposed.
            if (this._loadState === ItemLoadState.Loaded) ArtifactMemCache.decAssetRefCount(this.tokenKey);
        }

        super.dispose(doNotRecurse, disposeMaterialAndTextures);
    }

    public getOwner(): string {
        if (this.issuer) return this.issuer;

        const place = this.getPlace();
        const itemsTo = place.placeData!.itemsTo;
        if (itemsTo) return itemsTo;

        return place.currentOwner;
    }

    public getWorld(): BaseWorld {
        if (this.place_or_world instanceof BaseWorld)
            return this.place_or_world;
        else
            return this.place_or_world.world;
    }

    public getPlace(): BasePlaceNode {
        assert(this.place_or_world instanceof BasePlaceNode, "ItemNode does not belong to place node.");
        return this.place_or_world;
    }

    public updateFromData(data: string) {
        const [quat, pos, scale, flags, tele] = ItemDataParser.parse(data);

        this.rotationQuaternion = quat;
        this.position = pos;
        this.scaling.set(scale, scale, scale);
        this.disableCollision = hasFlag(flags, ItemDataFlags.DISABLE_COLLISIONS);
        this.recieveShadows = hasFlag(flags, ItemDataFlags.RECIEVE_SHADOWS);
        this.teleporterData = tele;
        //this.scaling.multiplyInPlace(new Vector3(scale, scale, scale));
    }

    public updateLOD(camPos: DeepImmutable<Vector3>): boolean {
        const previousEnabled = this.isEnabled(false);
        let newEnabled = previousEnabled;

        // If the item is marked for removal it needs to be disabled.
        if (this.markForRemoval) {
            newEnabled = false;
        }
        // Otherwise, it depends on the distance.
        else {
            const distance = Vector3.Distance(camPos, this.absolutePosition);
            if (distance < 20) {
                newEnabled = true;
            }
            else {
                const scale = this.scaling.x;
                const alpha = Math.tanh(scale / distance);
                newEnabled = alpha > 0.04;
            }
        }

        // Update enabled if it needs to be.
        if (newEnabled !== previousEnabled) this.setEnabled(newEnabled);

        return newEnabled;
    }

    private boundsNode: Nullable<TransformNode> = null;

    public setDisplayBounds(show: boolean, valid: Trilean) {
        const changed = show !== (this.boundsNode !== null);

        if (changed) {
            if (show) this.createBoundingBoxHelper(valid);
            else this.boundsNode!.dispose();
        }
    }

    /**
     * TODO: get material from scene, add a way to make it red, etc.
     * store both a ref to the holder and the actual item node as vars.
     * set a flag if helper should be drawn, etc.
     * show red box for out of bounds items if you have remove permission or own them.
     */
    private createBoundingBoxHelper(valid: Trilean) {
        // TODO: get valid/inalid material from world or scene.
        const material = new SimpleMaterial("transp", this.getScene());
        material.alpha = 0.2;
        material.backFaceCulling = false;
        material.diffuseColor = triHelper(valid,
            new Color3(0.2, 0.2, 0.8),
            new Color3(0.8, 0.2, 0.2),
            new Color3(0.2, 0.8, 0.2));

        const {min, max} = this.boundingVectors!;
        const extent = max.subtract(min);
        const bbox = new BoundingBox(min, max);

        const c_m = new Matrix();
        Matrix.FromXYZAxesToRef(bbox.directions[0], bbox.directions[1], bbox.directions[2], c_m);
        c_m.setTranslation(bbox.center)

        // positioning helper.
        const cube = MeshBuilder.CreateBox("bbox", {width: extent.x, height: extent.y, depth: extent.z, updatable: false }, this.getScene());
        cube.isPickable = false;
        cube.material = material;
        cube.parent = this;
        c_m.decompose(cube.scaling, undefined, cube.position);

        // TODO: if already set, only change material and transform.
        // rename to updateBoundingBoxHelper.
        assert(!this.boundsNode, "Bounds node was already set");
        this.boundsNode = cube;
    }

    public async loadItem() {
        // TODO: check if items been disposed?
        if (this._loadState === ItemLoadState.Loaded) {
            Logging.WarnDev("Attempted to reload token", this.tokenKey.id.toNumber());
            return;
        }

        try {
            const clone = this.teleporterData !== null || this._recieveShadows;
            await ArtifactMemCache.loadArtifact(this.tokenKey, this.getWorld().game, this, clone);
            this._loadState = ItemLoadState.Loaded;

            if (this.teleporterData) this.getWorld().game.addItemToHighlightLayer(this);

            // Enable/Disable collision.
            // TODO: find a better way that doesn't update child mesh collisions in checkCollisions.
            this.getChildMeshes().forEach((m) => {
                m.checkCollisions = !this._disableCollision;
            })

            if (this._recieveShadows) this.getChildMeshes().forEach((m) => {
                // Instanced meshes don't have a setter, but no idea how to figure out if an object
                // has a setter? see recieveShadows setter, maybe?
                m.receiveShadows = this._recieveShadows;
            });

            // TODO: see createBoundingBoxHelper
            //this.createBoundingBoxHelper();
        }
        catch(e: any) {
            this._loadState = ItemLoadState.Failed;
            throw e;
        }
    }

    public async loadFromFile(file: File) {
        // TODO: check if items been disposed?
        if (this._loadState === ItemLoadState.Loaded) {
            Logging.WarnDev("Attempted to reload token", this.tokenKey.id.toNumber());
            return;
        }

        try {
            // TODO: pass token key?
            await ArtifactMemCache.loadFromFile(file, this.tokenKey, this._scene, this);
            this._loadState = ItemLoadState.Loaded;

            // TODO: see createBoundingBoxHelper
            //this.createBoundingBoxHelper();
        }
        catch(e: any) {
            this._loadState = ItemLoadState.Failed;
            throw e;
        }
    }

    public queueLoadItemTask(world: World, place: BasePlaceNode) {
        this._loadState = ItemLoadState.Queued;

        // TODO: priority, retry, etc
        // TODO: priority should depend on distance
        const dist = this.getDistanceToCamera();
        const priority = this.scaling.x * (1 / (dist * dist)) * 1000;

        world.game.loadingQueue.add(
            LoadItemTask(this, place),
            { priority: priority })
        .catch(reason => {
            Logging.Warn("Failed to load token", this.tokenKey.id.toNumber(), reason);
        }); // TODO: handle error somehow
    }

    /**
     * @returns True if it's a valid item. False if it's a model imported for preview.
     */
    public isValidItem(): boolean {
        return this.tokenKey.id.gte(0);
    }

    public static CreateItemNode(place_or_world: BasePlaceNode | BaseWorld, tokenKey: TokenKey, scene: Scene, parent: Nullable<Node>): ItemNode {
        const itemNode = new ItemNode(place_or_world, tokenKey, `item${tokenKey.id}`, scene);
        itemNode.parent = parent;

        return itemNode;
    }
}
