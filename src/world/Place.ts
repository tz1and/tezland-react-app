import { BoundingBox, Mesh, MeshBuilder, Nullable, Quaternion, Node,
    TransformNode, Vector3, ExecuteCodeAction, ActionManager, Color3, Material } from "@babylonjs/core";

import earcut from 'earcut';

import { getFloat16 } from "@petamoriken/float16";

import Contracts from "../tz/Contracts";
import * as ipfs from "../ipfs/ipfs";
import { fromHexString, mutezToTez, pointIsInside } from "../utils/Utils";
import { World } from "./World";
import { SimpleMaterial } from "@babylonjs/materials";
import { Logging } from "../utils/Logging";
import BigNumber from "bignumber.js";
import AppSettings from "../storage/AppSettings";


export type InstanceMetadata = {
    id: BigNumber;
    placeId: number;
    itemTokenId: BigNumber;
    xtzPerItem: number;
    itemAmount: BigNumber;
    markForRemoval: boolean;
}


export type PlaceId = number;


export default class Place {
    readonly placeId: number;
    private world: World;

    private placeBounds: Nullable<Mesh>;
    private placeGround: Nullable<Mesh>;

    private _origin: Vector3;
    get origin(): Vector3 { return this._origin.clone(); }

    private _buildHeight: number;
    get buildHeight(): number { return this._buildHeight; }

    // All saved items are stored in this.
    private _itemsNode: Nullable<TransformNode>;
    get itemsNode() { return this._itemsNode; }
    private set itemsNode(val: Nullable<TransformNode>) { this._itemsNode = val; }

    // Unsaved items are stored in here.
    // TODO: this really is a crutch. should be smarter about clearing items.
    private _tempItemsNode: Nullable<TransformNode>;
    get tempItemsNode() { return this._tempItemsNode; }
    private set tempItemsNode(val: Nullable<TransformNode>) { this._tempItemsNode = val; }

    get isOwnedOrOperated(): boolean { return this.isOperated; }
    private owner: string;
    private isOperated: boolean;

    constructor(placeId: number, world: World) {
        this.placeId = placeId;
        this.world = world;
        this.placeBounds = null;
        this.placeGround = null;
        this._origin = new Vector3();
        this._buildHeight = 0;
        this._itemsNode = null;
        this._tempItemsNode = null;
        this.owner = "";
        this.isOperated = false;
    }

    public dispose() {
        // TODO: have some flag if it's loading right now or something.
        this.placeBounds?.dispose();
        this.placeBounds = null;

        this.placeGround?.dispose();
        this.placeGround = null;

        this.itemsNode?.dispose();
        this.itemsNode = null;

        this.tempItemsNode?.dispose();
        this.tempItemsNode = null;
    }

    private extrudeMeshFromShape(shape: Vector3[], depth: number, pos: Vector3, mat: Material): Mesh {
        const extrude = MeshBuilder.ExtrudePolygon(`placeBounds${this.placeId}`, {
            shape: shape,
            depth: depth
        }, this.world.scene, earcut);

        extrude.material = mat;
        extrude.position = pos;
        extrude.isPickable = false;

        return extrude;
    }

    private polygonMeshFromShape(shape: Vector3[], pos: Vector3, mat: Material): Mesh {
        const poly = MeshBuilder.CreatePolygon(`placeBounds${this.placeId}`, {
            shape: shape
        }, this.world.scene, earcut);

        poly.material = mat;
        poly.position = pos;
        poly.isPickable = false;

        return poly;
    }

    // TODO: be smarter about loading items. don't reload everthing, maybe.
    public async load(placeMetadata: any) {
        try {
            //let startTime = performance.now()

            // Using ExtrudePolygon
            this._origin = Vector3.FromArray(placeMetadata.centerCoordinates);
            this._buildHeight = placeMetadata.buildHeight;

            var shape = new Array<Vector3>();
            placeMetadata.borderCoordinates.forEach((v: Array<number>) => {
                shape.push(Vector3.FromArray(v));
            });

            // TODO: make sure the place coordinates are going right around!
            shape = shape.reverse();

            // create bounds
            this.placeBounds = this.extrudeMeshFromShape(shape, this.buildHeight + 1, new Vector3(this.origin.x, this.buildHeight, this.origin.z),
                this.world.transparentGridMat);

            this.placeBounds.visibility = +AppSettings.displayPlaceBounds.value;
            // Call getHierarchyBoundingVectors to force updating the bounding info!
            this.placeBounds.getHierarchyBoundingVectors();

            // create ground
            this.placeGround = this.polygonMeshFromShape(shape, new Vector3(this.origin.x, 0, this.origin.z),
                new SimpleMaterial(`placeGroundMat${this.placeId}`, this.world.scene));
            this.placeGround.receiveShadows = true;

            // create temp items node
            this.tempItemsNode = new TransformNode(`placeTemp${this.placeId}`, this.world.scene);
            this.tempItemsNode.position = this.origin.clone();

            // update owner and operator ansychronously
            (async () => {
                this.owner = await Contracts.getPlaceOwner(this.placeId);
                // TODO: maybe reload isOperated when you enter a place.
                // OR EVEN BETTER. listen to walletChanged events and reload for all places.
                // OR EVEN EVEN BETTER. listen for specific contract events.
                this.isOperated = await Contracts.isPlaceOwnerOrOperator(this.world.walletProvider, this.placeId, this.owner);
            })()

            this.world.playerController.playerTrigger.actionManager?.registerAction(
                new ExecuteCodeAction(
                    {
                        trigger: ActionManager.OnIntersectionEnterTrigger,
                        parameter: { 
                            mesh: this.placeBounds, 
                            usePreciseIntersection: true
                        }
                    },
                    () => {
                        this.world.playerController.setCurrentPlace(this);
                        Logging.InfoDev("entered place: " + this.placeId)
                    },
                ),
            );

            //LoggingDev.InfoDev(`generating place took ${performance.now() - startTime} milliseconds`)

            // TODO:
            // Problem with loading asynchronously is that meshes could be loaded into the scene twice.
            // Needs to be fixed!
            //await
            this.loadItems(false);

            //LoggingDev.InfoDev(`Call to load took ${performance.now() - startTime} milliseconds`)
        } catch(e) {
            Logging.InfoDev("failed to load place " + this.placeId);
            Logging.InfoDev(e);
        }
    }

    // isUpdate should pretty much always be true unless called from Place.load()
    public async loadItems(isUpdate: boolean) {
        if(!this.placeBounds) {
            Logging.InfoDev("place bounds don't exist: " + this.placeId);
            return;
        }

        const placeHasUpdated = await Contracts.hasPlaceUpdated(this.world.walletProvider, this.placeId);

        if(isUpdate && !placeHasUpdated) return;

        // Load items
        const items = await Contracts.getItemsForPlaceView(this.world.walletProvider, this.placeId, placeHasUpdated);

        if(this.placeGround)
            (this.placeGround.material as SimpleMaterial).diffuseColor = Color3.FromHexString(`#${items.place_props}`);

        // remove old place items if they exist.
        if(this.itemsNode) {
            this.itemsNode.dispose();
            this.itemsNode = null;
            Logging.InfoDev("cleared old items");
        }

        // itemsNode must be in the origin.
        this.itemsNode = new TransformNode(`place${this.placeId}`, this.world.scene);
        this.itemsNode.position = this.origin.clone();
        
        const outOfBounds: number[] = [];

        //items.forEach(async (element: any) => {
        for (const element of items.stored_items) {
            if(!element.data.item) continue;

            // Set prototype to make sure BigNumbers get recognised.
            // See here: https://github.com/MikeMcl/bignumber.js/issues/245
            Object.setPrototypeOf(element.id, BigNumber.prototype);
            Object.setPrototypeOf(element.data.item.token_id, BigNumber.prototype);
            Object.setPrototypeOf(element.data.item.xtz_per_item, BigNumber.prototype);
            Object.setPrototypeOf(element.data.item.item_amount, BigNumber.prototype);

            const token_id = new BigNumber(element.data.item.token_id);
            const item_coords = element.data.item.item_data;
            const item_amount = element.data.item.item_amount;
            const xtz_per_item = mutezToTez(element.data.item.xtz_per_item).toNumber();
            
            try {
                const uint8array: Uint8Array = fromHexString(item_coords);
                const view = new DataView(uint8array.buffer);
                // 4 floats for quat, 1 float scale, 3 floats pos = 16 bytes
                const quat = new Quaternion(getFloat16(view, 0), getFloat16(view, 2), getFloat16(view, 4), getFloat16(view, 6));
                const scale = getFloat16(view, 8);
                const pos = new Vector3(getFloat16(view, 10), getFloat16(view, 12), getFloat16(view, 14));

                const instance = await ipfs.download_item(token_id, this.world.scene, this.itemsNode);

                if(instance) {
                    /*var sphere = Mesh.CreateSphere("sphere1", 12, scale, this.scene);*/
                    instance.parent = this.itemsNode;
                    instance.rotationQuaternion = quat;
                    instance.position = pos;
                    instance.scaling.multiplyInPlace(new Vector3(scale, scale, scale));
                    /*sphere.position.x = Math.random() * 20 - 10;
                    sphere.position.y = 1;
                    sphere.position.z = Math.random() * 20 - 10;*/
                    //sphere.material = this.defaultMaterial;
                    instance.metadata = {
                        id: new BigNumber(element.id),
                        placeId: this.placeId,
                        itemTokenId: token_id,
                        xtzPerItem: xtz_per_item,
                        itemAmount: new BigNumber(item_amount)
                    } as InstanceMetadata;

                    // TODO: for all submeshes/instances, whatever
                    //instance.checkCollisions = true;
                    this.world.shadowGenerator.addShadowCaster(instance as Mesh);

                    if(!this.isInBounds(instance)) {
                        outOfBounds.push(new BigNumber(element.id).toNumber());
                        instance.dispose();
                    }
                }
            }
            catch(e) {
                Logging.InfoDev("Failed to load placed item: ", e);
            }
        };

        if (outOfBounds.length > 0 && this.owner === this.world.walletProvider.walletPHK()) {
            this.world.appControlFunctions.addNotification({
                id: "oobItems" + this.placeId,
                title: "Out of bounds items!",
                body: `Your Place #${this.placeId} has out of bounds items!\n\nItem ids (in Place): ${outOfBounds.join(', ')}.`,
                type: 'warning'
            })
            Logging.Warn("place doesn't fully contain objects: " + outOfBounds.join(', '));
        }

        //this.octree = this.scene.createOrUpdateSelectionOctree();
    }

    public save(): boolean {
        if(!this.tempItemsNode || !this.itemsNode) {
            Logging.InfoDev("can't save: items not loaded: " + this.placeId);
            return false;
        }

        if(!this.isOwnedOrOperated) {
            Logging.InfoDev("can't save: place not owned or operated: " + this.placeId);
            return false;
        }

        // try to save items.
        const tempChildren = this.tempItemsNode.getChildren();
        const add_children = new Array<Node>();

        tempChildren.forEach((child) => {
            const metadata = child.metadata as InstanceMetadata;
            if(metadata.id === undefined) {
                add_children.push(child);
            }
        });

        const children = this.itemsNode.getChildren();
        const remove_children = new Array<Node>();

        children.forEach((child) => {
            const metadata = child.metadata as InstanceMetadata;
            if(metadata.markForRemoval === true) {
                remove_children.push(child);
            }
        });

        if (add_children.length === 0 && remove_children.length === 0) {
            // TODO: probably should throw exceptions here.
            Logging.InfoDev("Nothing to save");
            return false;
        }

        Contracts.saveItems(this.world.walletProvider, remove_children, add_children, this.placeId, this.owner, () => {
            if(this.tempItemsNode) {
                this.tempItemsNode.dispose();
                Logging.InfoDev("cleared temp items");

                // create NEW temp items node
                this.tempItemsNode = new TransformNode(`placeTemp${this.placeId}`, this.world.scene);
                this.tempItemsNode.position = this.origin.clone();
            }

            // TODO: does this really need to be called here?
            // subscription should handle it.
            this.loadItems(true);
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
}