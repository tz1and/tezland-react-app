import { Nullable, Scene, Node, TransformNode, DeepImmutable, Vector3 } from "@babylonjs/core";
import BigNumber from "bignumber.js";
import * as ipfs from "../ipfs/ipfs";
import ItemData from "../utils/ItemData";
import { Logging } from "../utils/Logging";
import PlaceNode from "./PlaceNode";
import { World } from "./World";


const LoadItemTask = (item: ItemNode, place: PlaceNode) => {
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

            // Add to out of bounds items to be displayed when owner enters.
            place.outOfBoundsItems.add(item.itemId.toNumber());

            // Dispose item.
            // TODO: Probably better to hide/disable items.
            // So they can eventually be shown to the owner for removal.
            item.dispose();
        }
    }
}


export enum ItemLoadState {
    NotLoaded = 0,
    Queued = 1,
    Loaded = 2
}


export default class ItemNode extends TransformNode {
    readonly placeId: number; // The place the item belongs to
    readonly tokenId: BigNumber; // The token this item represents
    public itemId: BigNumber; // The id of the item within the place
    public issuer: string; // The address that placed this item
    public xtzPerItem: number; // The price of the item
    public itemAmount: BigNumber; // The number of items
    public markForRemoval: boolean; // If the item should be removed

    public loadState: ItemLoadState;
    
    constructor(placeId: number, tokenId: BigNumber,
        name: string, scene?: Nullable<Scene>, isPure?: boolean) {
        super(name, scene, isPure);

        this.placeId = placeId;
        this.tokenId = tokenId;
        this.itemId = new BigNumber(-1);
        this.issuer = "";
        this.xtzPerItem = 0;
        this.itemAmount = new BigNumber(0);
        this.markForRemoval = false;

        this.loadState = ItemLoadState.NotLoaded;
    }

    // TODO: needs some custom stuff for displying in inspector.
    /*public override getClassName(): string {
        return "ItemNode";
    }*/

    public updateFromData(data: string) {
        const [quat, pos, scale] = ItemData.parse(data);

        this.rotationQuaternion = quat;
        this.position = pos;
        this.scaling.set(scale, scale, scale);
        //this.scaling.multiplyInPlace(new Vector3(scale, scale, scale));
    }

    public updateLOD(camPos: DeepImmutable<Vector3>): boolean {
        const previousEnabled = this.isEnabled(false);
        let newEnabled = previousEnabled;
        const distance = Vector3.Distance(camPos, this.absolutePosition);
        if (distance < 20) {
            newEnabled = true;
        }
        else {
            const scale = this.scaling.x;
            const alpha = Math.tanh(scale / distance);
            newEnabled = alpha > 0.04;
        }
        if (newEnabled !== previousEnabled) this.setEnabled(newEnabled);

        return newEnabled;
    }

    public async loadItem() {
        // TODO: check if items been disposed?
        if (this.loadState === ItemLoadState.Loaded) {
            Logging.WarnDev("Attempted to reload token", this.tokenId.toNumber());
            return;
        }

        await ipfs.download_item(this.tokenId, this._scene, this);

        this.loadState = ItemLoadState.Loaded;
    }

    public queueLoadItemTask(world: World, place: PlaceNode) {
        this.loadState = ItemLoadState.Queued;

        // TODO: priority, retry, etc
        // TODO: priority should depend on distance
        const dist = this.getDistanceToCamera();
        const priority = this.scaling.x * (1 / (dist * dist)) * 1000;

        world.loadingQueue.add(
            LoadItemTask(this, place),
            { priority: priority })
        .catch(reason => Logging.Warn("Failed to load token", this.tokenId.toNumber(), reason)); // TODO: handle error somehow
    }

    public static CreateItemNode(placeId: number, tokenId: BigNumber, scene: Scene, parent: Nullable<Node>): ItemNode {
        const itemNode = new ItemNode(placeId, tokenId, `item${tokenId}`, scene);
        itemNode.parent = parent;

        return itemNode;
    }
}
