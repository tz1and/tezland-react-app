import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import { GridMaterial, SimpleMaterial, SkyMaterial } from "@babylonjs/materials";

//import { QuakeController } from "../Controllers/QuakeController";
import PlayerController from "../controllers/PlayerController";

//import "@babylonjs/core/Meshes/meshBuilder";
import { Database, FreeCamera, Material, UniversalCamera } from "@babylonjs/core";
import Place, { PlaceId } from "./Place";
import { AppControlFunctions } from "./AppControlFunctions";
import { ITezosWalletProvider } from "../components/TezosWalletContext";
//import { isDev } from "../tz/Utils";
import Grid2D, { WorldGridAccessor } from "../utils/Grid2D";
import Metadata from "./Metadata";
import AppSettings from "../storage/AppSettings";


const placeDrawDistance = AppSettings.getDrawDistance();
const worldUpdateDistance = 10;


export class World {
    readonly camera: FreeCamera;
    readonly scene: Scene;
    
    private engine: Engine;
    private defaultMaterial: Material;
    readonly transparentGridMat: GridMaterial;
    
    private sunLight: DirectionalLight;
    
    readonly playerController: PlayerController;
    readonly shadowGenerator: ShadowGenerator;

    readonly places: Map<number, Place>;

    readonly walletProvider: ITezosWalletProvider;

    readonly worldGrid: Grid2D<Set<PlaceId>>;
    readonly worldGridAccessor: WorldGridAccessor;
    private gridCreateCallback = () => { return new Set<PlaceId>() }


    constructor(mount: HTMLCanvasElement, appControlfunctions: AppControlFunctions, walletProvider: ITezosWalletProvider) {
        // Get the canvas element from the DOM.
        const canvas = mount;
        const divFps = document.getElementById("fps");

        this.walletProvider = walletProvider;

        // This represents the whole map, all known places.
        this.worldGrid = new Grid2D<Set<PlaceId>>([50, 50]);
        this.worldGridAccessor = new WorldGridAccessor([1000, 1000], [500, 500]);
        // This represents the currently loaded places.
        this.places = new Map<number, Place>();

        // Associate a Babylon Engine to it.
        this.engine = new Engine(canvas, true);
        this.engine.disableManifestCheck = true;

        // Allow cache on IndexedDB
        Database.IDBStorageEnabled = true;

        // Create our first scene.
        this.scene = new Scene(this.engine);
        this.scene.collisionsEnabled = true;

        // Enable inspector in dev
        /*if(isDev()) {
            import("@babylonjs/inspector").then( () => {
                this.scene.debugLayer.show({ showExplorer: true, embedMode: true });
            });
        }*/

        this.camera = this.initCamera();

        // Create a default material
        this.defaultMaterial = new SimpleMaterial("defaulMat", this.scene);

        // transparent grid material for place bounds
        this.transparentGridMat = new GridMaterial("transp_grid", this.scene);
        this.transparentGridMat.opacity = 0.3;
        this.transparentGridMat.mainColor.set(0.2, 0.2, 0.8);
        this.transparentGridMat.lineColor.set(0.2, 0.8, 0.8);
        this.transparentGridMat.backFaceCulling = false;
        
        // Create sun and skybox
        let sun_direction = new Vector3(-50, -100, 50);
        this.sunLight = new DirectionalLight("sunLight", sun_direction, this.scene);
        this.sunLight.intensity = 0.5;
        //this.sunLight.autoCalcShadowZBounds = true;
        //this.sunLight.autoUpdateExtends = true;

        let ambient_light = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), this.scene);
        ambient_light.intensity = 0.4;
        ambient_light.diffuse = new Color3(0.7, 0.7, 1);
        ambient_light.specular = new Color3(1, 1, 0.7);
        ambient_light.groundColor = new Color3(1, 1, 0.7);

        // Our built-in 'ground' shape. Params: name, width, depth, subdivs, scene
        let ground = Mesh.CreateGround("ground1", 1000, 1000, 4, this.scene);
        ground.material = this.defaultMaterial;
        ground.checkCollisions = true;
        ground.receiveShadows = true;
        ground.position.y = -0.01;

        let skyMaterial = new SkyMaterial("skyMaterial", this.scene);
        skyMaterial.backFaceCulling = false;
        //skyMaterial.inclination = 0.25;
        skyMaterial.useSunPosition = true;
        skyMaterial.sunPosition = sun_direction.negate();

        let skybox = Mesh.CreateBox("skyBox", 1000.0, this.scene);
        skybox.material = skyMaterial;

        this.shadowGenerator = new ShadowGenerator(1024, this.sunLight);
        //this.shadowGenerator.autoCalcDepthBounds = true;
        this.shadowGenerator.useExponentialShadowMap = true;
        this.shadowGenerator.useBlurExponentialShadowMap = true;
        //this.shadowGenerator.usePoissonSampling = true;

        let loadedItemCache = new TransformNode("loadedItemCache", this.scene);
        loadedItemCache.position.y = -200;
        loadedItemCache.setEnabled(false);

        // create debug world
        //this.debugWorld();

        // TODO: this disable scene picking, but need to use onPointerDown, etc.
        /*this.scene.onPrePointerObservable.add((pointerInfo) => {
            pointerInfo.skipOnPointerObservable = true;
        });*/

        this.playerController = new PlayerController(this.camera, this, this.shadowGenerator, canvas, appControlfunctions);
        this.lastUpdatePosition = this.playerController.getPosition().clone();

        // Render every frame
        this.engine.runRenderLoop(() => {
            this.scene.render();
            divFps!.innerHTML = this.engine.getFps().toFixed() + " fps";
        });

        window.addEventListener('resize', () => { this.engine.resize(); });

        this.scene.registerAfterRender(this.updateWorld.bind(this));
    }

    public destroy() {
        // Destorying the engine should prbably be enough.
        this.worldGrid.clear();
        this.places.clear();

        this.engine.dispose();
        this.scene.dispose();
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
        camera.fovMode = UniversalCamera.FOVMODE_HORIZONTAL_FIXED;
        camera.fov = 2;
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

    // TODO: metadata gets re-loaded too often.
    // loadPlace should be definite. add another functio
    // that initially adds all places or soemthing.
    // Then go over this agiain.
    public async loadPlace(placeId: PlaceId) {
        if(this.places.has(placeId)) {
            // reload place
            this.places.get(placeId)!.loadItems();
        }
        else {
            // If the place isn't in the grid yet, add it
            let placeMetadata = await Metadata.getPlaceMetadata(placeId);
            const origin = Vector3.FromArray(placeMetadata.token_info.center_coordinates);
            const set = this.worldGrid.getOrAddA(this.worldGridAccessor, [origin.x, origin.z], this.gridCreateCallback);
            if(!set.has(placeId)) {
                console.log("add to set");
                set.add(placeId);
            }

            // Figure out by distance to player if the place should load
            const player_pos = this.playerController.getPosition();
            if(player_pos.subtract(origin).length() < placeDrawDistance) {
                console.log("load place");
                const new_place = new Place(placeId, this);
                await new_place.load();
                
                this.places.set(placeId, new_place);
            } else console.log("skip place");
        }
    }

    private lastUpdatePosition: Vector3;
    // TODO
    //private queuedPlaceUpdates: PlaceId[] = [];

    // TODO: go over this again.
    public updateWorld() {
        // Update world when player has moved a certain distance.
        const playerPos = this.playerController.getPosition();
        if(this.lastUpdatePosition.subtract(playerPos).length() > worldUpdateDistance)
        {
            const start_time = performance.now();
            this.lastUpdatePosition = playerPos.clone();

            // TODO: get grid cells in certain radius and load/unload places.

            //console.log("places in map before: ", this.places.size);
            this.places.forEach((v, k) => {
                // Multiply draw distance with small factor here to avoid imprecision and all that
                if(playerPos.subtract(v.origin).length() > placeDrawDistance * 1.02) {
                    this.places.delete(k);
                    v.dispose();
                    //removals.push(k)
                    //console.log("place removed from map");
                }
            });
            //console.log("places in map after: ", this.places.size);

            //console.log(playerPos);

            // search coords in world
            const minWorld: [number, number] = [playerPos.x - placeDrawDistance, playerPos.z - placeDrawDistance];
            const maxWorld: [number, number] = [playerPos.x + placeDrawDistance, playerPos.z + placeDrawDistance];

            //console.log(minWorld, maxWorld);

            // search coords in cells
            const minCell = Grid2D.max([0, 0], this.worldGridAccessor.accessor(minWorld, this.worldGrid.size));
            const maxCell = Grid2D.min(this.worldGrid.size, this.worldGridAccessor.accessor(maxWorld, this.worldGrid.size));

            //console.log(minCell, maxCell);

            // iterate over all places in all cells and see if they need to be loaded.
            //var counter = 0;
            // TODO: min/max with grid size
            for(let j = minCell[1]; j < maxCell[1]; ++j)
                for(let i = minCell[0]; i < maxCell[0]; ++i) {
                    const set = this.worldGrid.get([i, j])
                    if (set) {
                        set.forEach((id) => {
                            //counter++;
                            // early out
                            if(this.places.has(id)) return;
                            // maybe load
                            Metadata.getPlaceMetadata(id).then((placeMetadata) => {
                                const origin = Vector3.FromArray(placeMetadata.token_info.center_coordinates);
                                if(playerPos.subtract(origin).length() < placeDrawDistance) {
                                    // todo: add to pending updates instead.
                                    this.loadPlace(id);
                                }
                            });
                        })
                    }
                }

            const end_time = performance.now();
            console.log("updateWorld took " + (end_time - start_time).toFixed(2) + "ms");
            //console.log("checked places: " + counter);
        }
    }
}