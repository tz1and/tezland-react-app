import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Quaternion } from "@babylonjs/core/Maths/math";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import { GridMaterial } from "@babylonjs/materials/grid";
import { SimpleMaterial } from "@babylonjs/materials/simple";
import { SkyMaterial } from "@babylonjs/materials/sky";

import { AdvancedDynamicTexture, Button } from "@babylonjs/gui";

import "@babylonjs/inspector";

//import { QuakeController } from "../Controllers/QuakeController";
import PlayerController from "../Controllers/PlayerController";

import "@babylonjs/core/Meshes/meshBuilder";
import { BoundingBox, FreeCamera, Material, MeshBuilder, UniversalCamera } from "@babylonjs/core";
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
import { containsBox } from "../tz/Utils";


export class World {
    public camera: FreeCamera;
    public scene: Scene;

    private engine: Engine;
    private shadowGenerator: ShadowGenerator;
    private defaultMaterial: Material;

    private sunLight: DirectionalLight;

    public playerController: PlayerController;

    constructor() {
        // Get the canvas element from the DOM.
        const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
        const divFps = document.getElementById("fps");

        // Associate a Babylon Engine to it.
        this.engine = new Engine(canvas, true);

        // Create our first scene.
        this.scene = new Scene(this.engine);
        this.scene.collisionsEnabled = true;
        this.scene.debugLayer.show({ showExplorer: true, embedMode: true });

        this.camera = this.initCamera();

        // Create a default material
        this.defaultMaterial = new SimpleMaterial("defaulMat", this.scene);
        
        // Create sun and skybox
        var sun_direction = new Vector3(-50, -100, 50);
        this.sunLight = new DirectionalLight("sunLight", sun_direction, this.scene);
        this.sunLight.intensity = 0.5;
        //this.sunLight.autoCalcShadowZBounds = true;
        //this.sunLight.autoUpdateExtends = true;

        var ambient_light = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), this.scene);
        ambient_light.intensity = 0.4;
        ambient_light.diffuse = new Color3(0.7, 0.7, 1);
        ambient_light.specular = new Color3(1, 1, 0.7);
        ambient_light.groundColor = new Color3(1, 1, 0.7);

        // Our built-in 'ground' shape. Params: name, width, depth, subdivs, scene
        var ground = Mesh.CreateGround("ground1", 100, 100, 4, this.scene);
        ground.material = this.defaultMaterial;
        ground.checkCollisions = true;
        ground.receiveShadows = true;

        var skyMaterial = new SkyMaterial("skyMaterial", this.scene);
        skyMaterial.backFaceCulling = false;
        //skyMaterial.inclination = 0.25;
        skyMaterial.useSunPosition = true;
        skyMaterial.sunPosition = sun_direction.negate();

        var skybox = Mesh.CreateBox("skyBox", 1000.0, this.scene);
        skybox.material = skyMaterial;

        this.shadowGenerator = new ShadowGenerator(1024, this.sunLight);
        //this.shadowGenerator.autoCalcDepthBounds = true;
        this.shadowGenerator.useExponentialShadowMap = true;
        this.shadowGenerator.useBlurExponentialShadowMap = true;
        //this.shadowGenerator.usePoissonSampling = true;

        // create debug world
        //this.debugWorld();

        this.playerController = new PlayerController(this.camera, this.scene, this.shadowGenerator);

        // Render every frame
        this.engine.runRenderLoop(() => {
            this.scene.render();
            divFps!.innerHTML = this.engine.getFps().toFixed() + " fps";
        });

        window.addEventListener('resize', () => { this.engine.resize(); });
    }

    private debugWorld() {
        var transform_node = new TransformNode("transform", this.scene);

        for(let i = 0; i < 5; ++i) {
            // Our built-in 'sphere' shape. Params: name, subdivs, size, scene
            var sphere = Mesh.CreateSphere("sphere1", 36, 2, this.scene);
            sphere.parent = transform_node;
            sphere.position.x = Math.random() * 10 - 5;
            sphere.position.y = 1;
            sphere.position.z = Math.random() * 10 - 5;
            sphere.material = this.defaultMaterial;
            sphere.checkCollisions = true;
            this.shadowGenerator.addShadowCaster(sphere);
        }

        var box = Mesh.CreateBox("sphere1", 2, this.scene);
        box.position.set(10, 1, 0);
        box.material = this.defaultMaterial;
        box.checkCollisions = true;
        this.shadowGenerator.addShadowCaster(box);

        box = Mesh.CreateBox("sphere1", 2, this.scene);
        box.position.set(10, 3, 2);
        box.material = this.defaultMaterial;
        box.checkCollisions = true;
        this.shadowGenerator.addShadowCaster(box);

        var player = Mesh.CreateBox("player", 1, this.scene);
        player.position.y = 10;
        player.checkCollisions = true;
        player.ellipsoid.set(0.5, 0.5, 0.5);
        this.shadowGenerator.addShadowCaster(player);
    }

    private initCamera(): FreeCamera {
        // This creates and positions a free camera (non-mesh)
        var camera = new UniversalCamera("camera1", new Vector3(0, 2, -15), this.scene);

        // Camera props
        camera.fov = 1.2;
        camera.minZ = 0.1;

        // Collision stuff
        camera.checkCollisions = true;
        camera.applyGravity = true;
        camera.ellipsoid = new Vector3(0.5, 0.9, 0.5);

        // Set movement keys
        camera.keysLeft = [65 /*w*/, 37 /*left arrow*/];
        camera.keysRight = [68 /*d*/, 39 /*right arrow*/];
        camera.keysUp = [87 /*w*/, 38 /*up arrow*/];
        camera.keysDown = [83 /*s*/, 40 /*down arrow*/];
        //camera.keysUpward = [32 /*space*/]; // that's not actually jumping.
        camera.speed = 0.2;
        //this.camera.ellipsoidOffset = new Vector3(0, 0, 0);
        //camera.inertia = 0.5;
        //camera.angularSensibility = 2;
        //this.camera.checkCollisions = false;

        // This targets the camera to scene origin
        //camera.setTarget(Vector3.Zero());

        // This attaches the camera to the canvas
        //camera.attachControl(canvas, true);

        return camera;
    }

    public async loadPlace(placeId: number) {
        //console.log("loading something, hopefully");
        // Get item balances.
        //`${Conf.bcd_url}/v1/account/${Conf.tezos_network}/${Conf.dev_account}/token_balances?contract=${Conf.item_contract}`
        //const response = await axios.get(`${Conf.bcd_url}/v1/account/${Conf.tezos_network}/${Conf.dev_account}/token_balances?contract=${Conf.item_contract}`);
        //console.log(response.data);

        try {
            const responseP = await axios.get(`${Conf.bcd_url}/v1/tokens/${Conf.tezos_network}/metadata?contract=${Conf.place_contract}&token_id=${placeId}`);
            const tokenInfo = responseP.data[0].token_info;

            // create mat
            /*const transparent_mat = new SimpleMaterial("tranp", this.scene);
            transparent_mat.alpha = 0.2;
            //transparent_mat.disableLighting = true;
            //transparent_mat.backFaceCulling = false;
            transparent_mat.diffuseColor.set(0.2, 0.2, 0.8);*/
            const transparent_mat = new GridMaterial("transp_grid", this.scene);
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

            const placeBounds = MeshBuilder.ExtrudePolygon(`placeBounds${placeId}`, {
                shape: shape,
                depth: 11
            }, this.scene, earcut); 

            placeBounds.material = transparent_mat;
            placeBounds.position.x = origin.x;
            placeBounds.position.y = 10;
            placeBounds.position.z = origin.z;
            placeBounds.isPickable = false;

            await this.loadPlaceItems(placeId, placeBounds);
        } catch(e) {
            console.log("failed to load place " + placeId);
            console.log(e);
        }
    }

    public async loadPlaceItems(placeId: number, placeBounds: Mesh) {
        // Load items
        const items = await Contracts.getItemsForPlaceView(placeId);

        const fromHexString = (hexString: string) =>
            new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

        var transform_node = new TransformNode(`place${placeId}`, this.scene);

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

                const instance = await ipfs.download_item(item_id, this.scene, transform_node);

                if(instance) {
                    //console.log(quat);
                    //console.log(scale);
                    //console.log(pos);

                    /*var sphere = Mesh.CreateSphere("sphere1", 12, scale, this.scene);*/
                    instance.parent = transform_node;
                    instance.rotationQuaternion = quat;
                    instance.position = pos;
                    /*sphere.position.x = Math.random() * 20 - 10;
                    sphere.position.y = 1;
                    sphere.position.z = Math.random() * 20 - 10;*/
                    //sphere.material = this.defaultMaterial;
                    instance.metadata = { id: element.id, itemId: item_id };

                    // todo: for all submeshes/instances, whatever
                    //instance.checkCollisions = true;
                    //this.shadowGenerator.addShadowCaster(instance);

                    // This is very flakey at best.....
                    // Maybe write a mesh/boundingbox intersector
                    // calculate instance mesh bounding box
                    const {min, max} = instance.getHierarchyBoundingVectors(true);
                    const bbox = new BoundingBox(min, max);
                    // get place bounding box.
                    const placebbox = placeBounds.getBoundingInfo().boundingBox;

                    if(!containsBox(placebbox, bbox)) {
                        console.log("place doesn't fully contain object");
                        instance!.dispose();
                    }

                    /*if((instance as Mesh).intersectsMesh(placeBounds, true, true)) {
                        console.log("intersects");
                        instance!.dispose();
                    }*/
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

    //this.playerController = new QuakeController(player, this.camera, this.scene);
    //this.playerController.start();

    /*var advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");

    let loadedGUI = advancedTexture.parseFromURLAsync("https://doc.babylonjs.com/examples/ColorPickerGui.json");*/

    /*var button1 = Button.CreateSimpleButton("but1", "Click Me");
    button1.width = "150px"
    button1.height = "40px";
    button1.color = "white";
    button1.cornerRadius = 20;
    button1.background = "green";
    button1.onPointerUpObservable.add(function () {
        alert("you did it!");
    });
    advancedTexture.addControl(button1);*/
}