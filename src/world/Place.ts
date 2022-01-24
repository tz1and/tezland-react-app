import { BoundingBox, Mesh, MeshBuilder, Nullable, Quaternion, Node,
    TransformNode, Vector3, ExecuteCodeAction, ActionManager, Color3, Material } from "@babylonjs/core";

import earcut from 'earcut';

import { getFloat16 } from "@petamoriken/float16";

import Contracts from "../tz/Contracts";
import * as ipfs from "../ipfs/ipfs";
import { fromHexString, mutezToTez, pointIsInside } from "../utils/Utils";
import { World } from "./World";
import Metadata from "./Metadata";
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

    private _itemsNode: Nullable<TransformNode>;
    get itemsNode() { return this._itemsNode; }
    private set itemsNode(val: Nullable<TransformNode>) { this._itemsNode = val; }

    private owner: string;

    get isOwned(): boolean { return this.owner === this.world.walletProvider.walletPHK(); }
    private isOperated: boolean;

    constructor(placeId: number, world: World) {
        this.placeId = placeId;
        this.world = world;
        this.placeBounds = null;
        this.placeGround = null;
        this._origin = new Vector3();
        this._itemsNode = null;
        this.owner = "";
        this.isOperated = false;
    }

    public dispose() {
        // TODO: have some flag if it's loading right now or something.
        this.placeBounds?.dispose();
        this.placeGround?.dispose();
        this.itemsNode?.dispose();
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

    public async load() {
        try {
            //let startTime = performance.now()
            let placeMetadata = await Metadata.getPlaceMetadata(this.placeId);

            // create mat
            /*const transparent_mat = new SimpleMaterial("tranp", this.scene);
            transparent_mat.alpha = 0.2;
            //transparent_mat.disableLighting = true;
            //transparent_mat.backFaceCulling = false;
            transparent_mat.diffuseColor.set(0.2, 0.2, 0.8);*/
            //transparent_mat.wireframe = true;

            // Using polygon mesh builder (only 2D)
            /*// convert to path
            var poly_path = new Array<Vector2>();
            tokenInfo.border_coordinates.forEach((v: Array<number>) => {
                //poly_path.push(Vector3.FromArray(v));
                poly_path.push(new Vector2(v[0], v[2]));
            });

            // TODO: make sure the place coordinates are going right around!
            poly_path = poly_path.reverse();

            console.log(poly_path);

            const polygon_triangulation = new PolygonMeshBuilder("name", poly_path, this.scene, earcut);
            const polygon = polygon_triangulation.build(false, 11);
            polygon.material = transparent_mat;
            polygon.position.y += 10;*/

            // Using ExtrudePolygon
            this._origin = Vector3.FromArray(placeMetadata.token_info.center_coordinates);

            var shape = new Array<Vector3>();
            placeMetadata.token_info.border_coordinates.forEach((v: Array<number>) => {
                shape.push(Vector3.FromArray(v));
            });

            // TODO: make sure the place coordinates are going right around!
            shape = shape.reverse();

            // TODO: store place build height in metadata!
            // create bounds
            this.placeBounds = this.extrudeMeshFromShape(shape, 11, new Vector3(this.origin.x, 10, this.origin.z),
                this.world.transparentGridMat);

            this.placeBounds.visibility = +AppSettings.getDisplayPlaceBounds();

            // create ground
            this.placeGround = this.polygonMeshFromShape(shape, new Vector3(this.origin.x, 0, this.origin.z),
                new SimpleMaterial(`placeGroundMat${this.placeId}`, this.world.scene));
            this.placeGround.receiveShadows = true;

            this.owner = await Contracts.getPlaceOwner(this.placeId);
            // TODO: maybe reload isOperated when you enter a place.
            // OR EVEN BETTER. listen to walletChanged events and reload for all places.
            // OR EVEN EVEN BETTER. listen for specific contract events.
            this.isOperated = await Contracts.isPlaceOwnerOrOperator(this.world.walletProvider, this.placeId, this.owner);

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

            //console.log(`generating place took ${performance.now() - startTime} milliseconds`)

            await this.loadItems();

            //console.log(`Call to load took ${performance.now() - startTime} milliseconds`)
        } catch(e) {
            Logging.InfoDev("failed to load place " + this.placeId);
            console.log(e);
        }
    }

    public async loadItems() {
        if(!this.placeBounds) {
            Logging.InfoDev("place bounds don't exist: " + this.placeId);
            return;
        }

        // Load items
        const items = await Contracts.getItemsForPlaceView(this.world.walletProvider, this.placeId);

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

        //items.forEach(async (element: any) => {
        for (const element of items.stored_items) {
            if(!element.data.item) continue;

            // Set prototype to make sure BigNumbers get recognised.
            // See here: https://github.com/MikeMcl/bignumber.js/issues/245
            Object.setPrototypeOf(element.id, BigNumber.prototype);
            Object.setPrototypeOf(element.data.item.item_id, BigNumber.prototype);
            Object.setPrototypeOf(element.data.item.xtz_per_item, BigNumber.prototype);
            Object.setPrototypeOf(element.data.item.item_amount, BigNumber.prototype);

            const item_id = new BigNumber(element.data.item.item_id);
            const item_coords = element.data.item.item_data;
            const item_amount = element.data.item.item_amount;
            const xtz_per_item = mutezToTez(element.data.item.xtz_per_item).toNumber();
            
            try {
                //console.log(item_coords);

                const uint8array: Uint8Array = fromHexString(item_coords);//new TextEncoder().encode(item_coords);
                const view = new DataView(uint8array.buffer);
                // 4 floats for quat, 1 float scale, 3 floats pos = 16 bytes
                const quat = new Quaternion(getFloat16(view, 0), getFloat16(view, 2), getFloat16(view, 4), getFloat16(view, 6));
                const scale = getFloat16(view, 8);
                const pos = new Vector3(getFloat16(view, 10), getFloat16(view, 12), getFloat16(view, 14));

                const instance = await ipfs.download_item(item_id, this.world.scene, this.itemsNode);

                if(instance) {
                    //console.log(quat);
                    //console.log(scale);
                    //console.log(pos);

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
                        itemTokenId: item_id,
                        xtzPerItem: xtz_per_item,
                        itemAmount: new BigNumber(item_amount)
                    } as InstanceMetadata;

                    // todo: for all submeshes/instances, whatever
                    //instance.checkCollisions = true;
                    this.world.shadowGenerator.addShadowCaster(instance as Mesh);

                    if(!this.isInBounds(instance)) {
                        Logging.InfoDev("place doesn't fully contain object");
                        instance.dispose();
                    }
                }
            }
            catch(e) {
                /*console.log(item_coords.length);
                var hex = item_coords.split("")
                    .map((c: string) => c.charCodeAt(0).toString(16).padStart(2, "0"))
                    .join("");

                console.log(hex);
                console.log(item_coords);*/
            }
        };

        //this.octree = this.scene.createOrUpdateSelectionOctree();
    }

    public save() {
        if(!this.itemsNode) {
            Logging.InfoDev("can't save: items not loaded: " + this.placeId);
            return;
        }

        if(!this.isOwned) {
            Logging.InfoDev("can't save: place not owned: " + this.placeId);
            return;
        }

        // try to save items.
        const children = this.itemsNode.getChildren();
        const add_children = new Array<Node>();
        const remove_children = new Array<Node>();

        children.forEach((child) => {
            const metadata = child.metadata as InstanceMetadata;
            if(metadata.id === undefined) {
                add_children.push(child);
            } else if(metadata.markForRemoval === true) {
                remove_children.push(child);
            }
        });

        if (add_children.length === 0 && remove_children.length === 0) {
            // TODO: probably should throw exceptions here.
            Logging.InfoDev("Nothing to save");
            return;
        }

        Contracts.saveItems(this.world.walletProvider, remove_children, add_children, this.placeId, this.owner, () => {
            this.loadItems();
        });
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