import { Nullable, Scene, Node, TransformNode } from "@babylonjs/core";
import BigNumber from "bignumber.js";
import * as ipfs from "../ipfs/ipfs";
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
        
        if (!place.isInBounds(item)) {
            Logging.Warn(`place #${place.placeId} doesn't fully contain item with id`, item.itemId.toNumber());
            // TODO: mark as out of bounds if place is player owned, otherwise dispose.
            // TODO: maybe show notifications?
            //outOfBounds.push(new BigNumber(element.item_id).toNumber());
            /*if (outOfBounds.length > 0 && this.owner === this.world.walletProvider.walletPHK()) {
                this.world.appControlFunctions.addNotification({
                    id: "oobItems" + this.placeId,
                    title: "Out of bounds items!",
                    body: `Your Place #${this.placeId} has out of bounds items!\n\nItem ids (in Place): ${outOfBounds.join(', ')}.`,
                    type: 'warning'
                })
                Logging.Warn("place doesn't fully contain objects: " + outOfBounds.join(', '));
            }*/
            item.dispose();
        }
    }
}


export default class ItemNode extends TransformNode {
    readonly placeId: number; // The place the item belongs to
    readonly tokenId: BigNumber; // The token this item represents
    public itemId: BigNumber; // The id of the item within the place
    public issuer: string; // The address that placed this item
    public xtzPerItem: number; // The price of the item
    public itemAmount: BigNumber; // The number of items
    public markForRemoval: boolean; // If the item should be removed

    private modelLoaded: boolean;
    
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

        this.modelLoaded = false;
    }

    // TODO: needs some custom stuff for displying in inspector.
    /*public override getClassName(): string {
        return "ItemNode";
    }*/

    public async loadItem() {
        // TODO: check if items been disposed?
        if (this.modelLoaded) {
            Logging.WarnDev("Attempted to reload token", this.tokenId.toNumber());
            return;
        }

        await ipfs.download_item(this.tokenId, this._scene, this);

        this.modelLoaded = true;
    }

    public queueLoadItemTask(world: World, place: PlaceNode) {
        // TODO: priority, retry, etc
        // TODO: priority should depend on distance
        const dist = this.getDistanceToCamera();
        const priority = this.scaling.x * (1 / (dist * dist)) * 1000;

        world.loadingQueue.add(
            LoadItemTask(this, place),
            { priority: priority })
        .catch(reason => Logging.Warn("Failed to load token", this.tokenId.toNumber())); // TODO: handle error somehow
    }

    public static CreateItemNode(placeId: number, tokenId: BigNumber, scene: Scene, parent: Nullable<Node>): ItemNode {
        const itemNode = new ItemNode(placeId, tokenId, `item${tokenId}`, scene);
        itemNode.parent = parent;

        return itemNode;
    }
}
