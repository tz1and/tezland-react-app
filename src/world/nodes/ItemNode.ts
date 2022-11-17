import { Nullable, Scene, Node, TransformNode, DeepImmutable, Vector3,
    MeshBuilder, BoundingBox, Matrix, Color3 } from "@babylonjs/core";
import { SimpleMaterial } from "@babylonjs/materials";
import BigNumber from "bignumber.js";
import ArtifactMemCache from "../../utils/ArtifactMemCache";
import { ItemDataFlags, ItemDataParser, TeleporterData } from "../../utils/ItemData";
import { Logging } from "../../utils/Logging";
import { BaseWorld } from "../BaseWorld";
import { World } from "../World";
import { triHelper, Trilean } from "../../forms/FormUtils";
import BasePlaceNode from "./BasePlaceNode";
import assert from "assert";


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
            Logging.WarnDev(`place #${place.placeId} doesn't fully contain item with id`, item.itemId.toNumber());

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
    readonly tokenId: BigNumber; // The token this item represents
    public itemId: BigNumber; // The id of the item within the place
    public issuer: string; // The address that placed this item
    public xtzPerItem: number; // The price of the item
    public itemAmount: BigNumber; // The number of items
    public markForRemoval: boolean; // If the item should be removed

    private _loadState: ItemLoadState;
    public get loadState(): ItemLoadState { return this._loadState; }

    private _disableCollision: boolean;
    public get disableCollisions() { return this._disableCollision; }
    public set disableCollisions(val: boolean) {
        // if changed, disable/enable collisions
        if (this._disableCollision !== val) {
            this._disableCollision = val;
            // TODO: disable/enabled collision on all sub-meshes
            this.getChildMeshes().forEach((m) => { m.checkCollisions = !this._disableCollision; })
        }
    }

    public teleporterData: Nullable<TeleporterData>;

    public boundingVectors: Nullable<{
        min: Vector3;
        max: Vector3;
    }>;

    constructor(place_or_world: BasePlaceNode | BaseWorld, tokenId: BigNumber,
        name: string, scene?: Nullable<Scene>, isPure?: boolean) {
        super(name, scene, isPure);

        this.place_or_world = place_or_world;
        this.tokenId = tokenId;
        this.itemId = new BigNumber(-1);
        this.issuer = "";
        this.xtzPerItem = 0;
        this.itemAmount = new BigNumber(0);
        this.markForRemoval = false;

        this._disableCollision = false;
        this.teleporterData = null;

        this._loadState = ItemLoadState.NotLoaded;

        this.boundingVectors = null;
    }

    // TODO: needs some custom stuff for displying in inspector.
    /*public override getClassName(): string {
        return "ItemNode";
    }*/

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
        this.disableCollisions = (flags & ItemDataFlags.DISABLE_COLLISIONS) === ItemDataFlags.DISABLE_COLLISIONS;
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
            Logging.WarnDev("Attempted to reload token", this.tokenId.toNumber());
            return;
        }

        try {
            await ArtifactMemCache.loadArtifact(this.tokenId, this.getWorld().game, this, this._disableCollision);
            this._loadState = ItemLoadState.Loaded;

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
            Logging.WarnDev("Attempted to reload token", this.tokenId.toNumber());
            return;
        }

        try {
            await ArtifactMemCache.loadFromFile(file, this.tokenId, this._scene, this);
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
            Logging.Warn("Failed to load token", this.tokenId.toNumber(), reason);
        }); // TODO: handle error somehow
    }

    /**
     * @returns True if it's a valid item. False if it's a model imported for preview.
     */
    public isValidItem(): boolean {
        return this.tokenId.gte(0);
    }

    public static CreateItemNode(place_or_world: BasePlaceNode | BaseWorld, tokenId: BigNumber, scene: Scene, parent: Nullable<Node>): ItemNode {
        const itemNode = new ItemNode(place_or_world, tokenId, `item${tokenId}`, scene);
        itemNode.parent = parent;

        return itemNode;
    }
}
