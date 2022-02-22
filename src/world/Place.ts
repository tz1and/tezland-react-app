import { BoundingBox, Mesh, MeshBuilder, Nullable, Quaternion, Node,
    TransformNode, Vector3, ExecuteCodeAction, ActionManager, Color3, Material } from "@babylonjs/core";

import earcut from 'earcut';

import { getFloat16 } from "@petamoriken/float16";

import Contracts from "../tz/Contracts";
import * as ipfs from "../ipfs/ipfs";
import { fromHexString, mutezToTez, pointIsInside, yesNo } from "../utils/Utils";
import { World } from "./World";
import { SimpleMaterial } from "@babylonjs/materials";
import { Logging } from "../utils/Logging";
import BigNumber from "bignumber.js";
import AppSettings from "../storage/AppSettings";
import assert from "assert";


export type InstanceMetadata = {
    id: BigNumber;
    issuer: string;
    placeId: number;
    itemTokenId: BigNumber;
    xtzPerItem: number;
    itemAmount: BigNumber;
    markForRemoval: boolean;
}


export type PlaceId = number;


export class PlacePermissions {
    private _permissions: number;

    // should mirror the permissions from TL_World contract.
    public static permissionNone: number       = 0;
    public static permissionPlaceItems: number = 1;
    public static permissionModifyAll: number  = 2;
    public static permissionProps: number      = 4;
    public static permissionFull: number       = 7;

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

        return `PlaceItems:${yesNo(this.hasPlaceItems())}, ModifyAll:${yesNo(this.hasPlaceItems())}, Props:${yesNo(this.hasProps())}`;
    }
};


export default class Place {
    readonly placeId: number;
    private world: World;

    private placeBounds: Nullable<Mesh>;
    private placeGround: Nullable<Mesh>;

    private executionAction: Nullable<ExecuteCodeAction> = null;

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

    get getPermissions(): PlacePermissions { return this.permissions; }
    get currentOwner(): string { return this.owner; }
    private owner: string;
    private permissions: PlacePermissions;

    private savePending: boolean;

    constructor(placeId: number, world: World) {
        this.placeId = placeId;
        this.world = world;
        this.placeBounds = null;
        this.placeGround = null;
        this._origin = new Vector3();
        this._buildHeight = 0;
        this._itemsNode = null;
        this._tempItemsNode = null;
        this.savePending = false;
        this.owner = "";
        this.permissions = new PlacePermissions(PlacePermissions.permissionNone);
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

        // unregister execution action
        if (this.executionAction) {
            this.world.playerController.playerTrigger.actionManager?.unregisterAction(this.executionAction);
        }
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
            //let start_time = performance.now()

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

            this.executionAction = new ExecuteCodeAction(
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
            );

            // update owner and operator, excution action, loading items ansychronously
            (async () => {
                //const load_start_time = performance.now();

                this.owner = await Contracts.getPlaceOwner(this.placeId);
                // TODO: maybe reload isOperated when you enter a place.
                // OR EVEN BETTER. listen to walletChanged events and reload for all places.
                // OR EVEN EVEN BETTER. listen for specific contract events.
                this.permissions = await Contracts.getPlacePermissions(this.world.walletProvider, this.placeId, this.owner);

                // register player trigger when place owner info has loaded.
                assert(this.executionAction);
                this.world.playerController.playerTrigger.actionManager?.registerAction(this.executionAction);

                // TODO:
                // Problem with loading asynchronously is that meshes could be loaded into the scene twice.
                // Needs to be fixed!
                //await
                await this.loadItems(false);

                //const load_elapsed = performance.now() - load_start_time;
                //Logging.InfoDev(`Place loading took ${load_elapsed}ms`)
            })().catch((reason: any) => {
                Logging.InfoDev("failed to load items/ownership " + this.placeId);
                Logging.InfoDev(reason);
            })

            //const elapsed = performance.now() - start_time;
            //Logging.InfoDev(`generating place took ${elapsed}ms`)
        } catch(e) {
            Logging.InfoDev("failed to load place " + this.placeId);
            Logging.InfoDev(e);
        }
    }

    // isUpdate should pretty much always be true unless called from Place.load()
    // TODO: make sure it doesn't throw exception is potentially not caught.
    public async loadItems(isUpdate: boolean) {
        try {
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
                Object.setPrototypeOf(element.item_id, BigNumber.prototype);
                Object.setPrototypeOf(element.data.item.token_id, BigNumber.prototype);
                Object.setPrototypeOf(element.data.item.xtz_per_item, BigNumber.prototype);
                Object.setPrototypeOf(element.data.item.item_amount, BigNumber.prototype);

                const issuer = element.issuer;
                const token_id = new BigNumber(element.data.item.token_id);
                const item_coords = element.data.item.item_data;
                const item_amount = element.data.item.item_amount;
                const xtz_per_item = mutezToTez(element.data.item.xtz_per_item).toNumber();
                
                try {
                    const uint8array: Uint8Array = fromHexString(item_coords);
                    const view = new DataView(uint8array.buffer);
                    // 3 floats for euler angles, 3 floats pos, 1 float scale = 14 bytes
                    const quat = Quaternion.FromEulerAngles(getFloat16(view, 0), getFloat16(view, 2), getFloat16(view, 4));
                    const pos = new Vector3(getFloat16(view, 6), getFloat16(view, 8), getFloat16(view, 10));
                    const scale = getFloat16(view, 12);

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
                            id: new BigNumber(element.item_id),
                            issuer: issuer,
                            placeId: this.placeId,
                            itemTokenId: token_id,
                            xtzPerItem: xtz_per_item,
                            itemAmount: new BigNumber(item_amount)
                        } as InstanceMetadata;

                        // TODO: for all submeshes/instances, whatever
                        //instance.checkCollisions = true;
                        this.world.shadowGenerator?.addShadowCaster(instance as Mesh);

                        if(!this.isInBounds(instance)) {
                            outOfBounds.push(new BigNumber(element.item_id).toNumber());
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
        catch(e: any) {
            Logging.Error("Failed to load items for place: " + e)
        }
    }

    public save(): boolean {
        if(!this.tempItemsNode || !this.itemsNode) {
            Logging.InfoDev("can't save: items not loaded: " + this.placeId);
            return false;
        }

        if(this.savePending) {
            Logging.Info("Can't save again while operaton is pending: " + this.placeId);
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

        this.savePending = true;

        Contracts.saveItems(this.world.walletProvider, remove_children, add_children, this.placeId, this.owner, (completed: boolean) => {
            this.savePending = false;

            // Only remove temp items if op completed.
            if(completed) {
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
}