import { Nullable, Scene, Node, TransformNode } from "@babylonjs/core";
import BigNumber from "bignumber.js";
import * as ipfs from "../ipfs/ipfs";
import Place from "./Place";
import { World } from "./World";


export default class ItemNode extends TransformNode {
    readonly placeId: number; // The place the item belongs to
    readonly tokenId: BigNumber; // The token this item represents
    public itemId: BigNumber; // The id of the item within the place
    public issuer: string; // The address that placed this item
    public xtzPerItem: number; // The price of the item
    public itemAmount: BigNumber; // The number of items
    public markForRemoval: boolean; // If the item should be removed
    
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
    }

    // TODO: needs some custom stuff for displying in inspector.
    /*public override getClassName(): string {
        return "ItemNode";
    }*/

    public async loadItem(boundsCheck?: Place) {
        // TODO: queue, retry, etc
        //const instance =
        await ipfs.download_item(this.tokenId, this._scene, this);

        // TODO: bounds check needs to happen after loading.
        if(boundsCheck && !boundsCheck.isInBounds(this)) {
            //outOfBounds.push(new BigNumber(element.item_id).toNumber());
            // TODO: mark as out of bounds if place is player owned, otherwise dispose.
            this.dispose();
        }
    }

    public queueLoadItem(world: World, place: Place) {
        // TODO: priority, retry, etc
        world.loadingQueue.add(() => this.loadItem(place), { priority: this.scaling.x * 10 });
    }

    public static CreateItemNode(placeId: number, tokenId: BigNumber, scene: Scene, parent: Nullable<Node>): ItemNode {
        const itemNode = new ItemNode(placeId, tokenId, `item${tokenId}`, scene);
        itemNode.parent = parent;

        return itemNode;
    }
}
