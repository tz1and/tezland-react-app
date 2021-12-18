import { GridMaterial } from "@babylonjs/materials/grid";
import { BoundingBox, Mesh, MeshBuilder, Nullable, Quaternion, Node, TransformNode, Vector3 } from "@babylonjs/core";

import earcut from 'earcut';

import {
    Float16Array, isFloat16Array,
    getFloat16, setFloat16,
    hfround,
} from "@petamoriken/float16";

import axios from 'axios';
import Conf from "../Config";
import Contracts from "../tz/Contracts";
import * as ipfs from "../ipfs/ipfs";
import { pointIsInside } from "../tz/Utils";
import { World } from "./World";


export default class Place {
    readonly placeId: number;
    readonly world: World;

    private placeBounds: Nullable<Mesh>;
    private itemsNode: Nullable<TransformNode>;

    constructor(placeId: number, world: World) {
        this.placeId = placeId;
        this.world = world;
        this.placeBounds = null;
        this.itemsNode = null;
    }

    public async load() {
        //console.log("loading something, hopefully");
        // Get item balances.
        //`${Conf.bcd_url}/v1/account/${Conf.tezos_network}/${Conf.dev_account}/token_balances?contract=${Conf.item_contract}`
        //const response = await axios.get(`${Conf.bcd_url}/v1/account/${Conf.tezos_network}/${Conf.dev_account}/token_balances?contract=${Conf.item_contract}`);
        //console.log(response.data);

        try {
            const responseP = await axios.get(`${Conf.bcd_url}/v1/tokens/${Conf.tezos_network}/metadata?contract=${Conf.place_contract}&token_id=${this.placeId}`);
            const tokenInfo = responseP.data[0].token_info;

            // create mat
            /*const transparent_mat = new SimpleMaterial("tranp", this.scene);
            transparent_mat.alpha = 0.2;
            //transparent_mat.disableLighting = true;
            //transparent_mat.backFaceCulling = false;
            transparent_mat.diffuseColor.set(0.2, 0.2, 0.8);*/
            const transparent_mat = new GridMaterial("transp_grid", this.world.scene);
            transparent_mat.opacity = 0.3;
            transparent_mat.mainColor.set(0.2, 0.2, 0.8);
            transparent_mat.lineColor.set(0.2, 0.8, 0.8);
            transparent_mat.backFaceCulling = false;
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
            const origin = Vector3.FromArray(tokenInfo.center_coordinates);

            var shape = new Array<Vector3>();
            tokenInfo.border_coordinates.forEach((v: Array<number>) => {
                shape.push(Vector3.FromArray(v));
            });

            // TODO: make sure the place coordinates are going right around!
            shape = shape.reverse();

            const placeBounds = MeshBuilder.ExtrudePolygon(`placeBounds${this.placeId}`, {
                shape: shape,
                depth: 11
            }, this.world.scene, earcut); 

            placeBounds.material = transparent_mat;
            placeBounds.position.x = origin.x;
            placeBounds.position.y = 10;
            placeBounds.position.z = origin.z;
            placeBounds.isPickable = false;

            this.placeBounds = placeBounds;

            await this.loadItems();
        } catch(e) {
            console.log("failed to load place " + this.placeId);
            console.log(e);
        }
    }

    public async loadItems() {
        if(!this.placeBounds) {
            console.log("place bounds don't exist: " + this.placeId);
            return;
        }

        // Load items
        const items = await Contracts.getItemsForPlaceView(this.placeId);

        const fromHexString = (hexString: string) =>
            new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

        // remove old place items if they exist.
        if(this.itemsNode) {
            this.itemsNode.dispose();
            this.itemsNode = null;
            console.log("cleared old items");
        }

        this.itemsNode = new TransformNode(`place${this.placeId}`, this.world.scene);

        //items.forEach(async (element: any) => {
        for (const element of items) {
            const item_id = element.data.item_id;
            const item_coords = element.data.item_data;
            // temp, sometimes bytes are shown as string in bcd api???
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
                    instance.metadata = { id: element.id, itemId: item_id };

                    // todo: for all submeshes/instances, whatever
                    //instance.checkCollisions = true;
                    this.world.shadowGenerator.addShadowCaster(instance as Mesh);

                    if(!this.isInBounds(instance)) {
                        console.log("place doesn't fully contain object");
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

    public async save() {
        if(!this.itemsNode) {
            console.log("can't save: items not loaded: " + this.placeId);
            return;
        }

        // TODO: check ownership or wahtever

        // try to save items.
        // TODO: figure out removals.
        const children = this.itemsNode.getChildren();
        const add_children = new Array<Node>();

        children.forEach((child) => {
            if(child.metadata.id == undefined) {
                add_children.push(child);
            }
        });

        Contracts.saveItems(new Array<any>(), add_children, this.placeId).then(() => {
            this.loadItems();
        });
    }

    public isInBounds(object: Node) {
        if(!this.placeBounds) return false;

        const {min, max} = object.getHierarchyBoundingVectors(true);
        const bbox = new BoundingBox(min, max);

        for(var i = 0; i < bbox.vectorsWorld.length; ++i) {
            const p = bbox.vectorsWorld[i];

            if(!pointIsInside(p, this.placeBounds))
                return false;
        }

        return true;
    }
}