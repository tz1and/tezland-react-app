import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
//import { CascadedShadowGenerator } from "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { GridMaterial, SimpleMaterial, SkyMaterial } from "@babylonjs/materials";
import PlayerController from "../controllers/PlayerController";
import { Database, Material, Nullable } from "@babylonjs/core";
import Place, { PlaceId } from "./Place";
import { AppControlFunctions } from "./AppControlFunctions";
import { ITezosWalletProvider } from "../components/TezosWalletContext";
import Grid2D, { Tuple, WorldGridAccessor } from "../utils/Grid2D";
import Metadata from "./Metadata";
import AppSettings from "../storage/AppSettings";
import Contracts from "../tz/Contracts";
import { Logging } from "../utils/Logging";
import { OperationContent, Subscription } from "@taquito/taquito";
import { OperationContentsAndResultTransaction } from '@taquito/rpc'
import { ParameterSchema } from '@taquito/michelson-encoder'
//import { isDev } from "../utils/Utils";


const worldUpdateDistance = 10;


export class World {
    readonly appControlFunctions: AppControlFunctions;
    readonly scene: Scene;
    
    private engine: Engine;
    private defaultMaterial: Material;
    readonly transparentGridMat: GridMaterial;
    
    private sunLight: DirectionalLight;
    
    readonly playerController: PlayerController;
    readonly shadowGenerator: Nullable<ShadowGenerator>;

    readonly places: Map<number, Place>;

    readonly walletProvider: ITezosWalletProvider;

    readonly worldGrid: Grid2D<Set<PlaceId>>;
    readonly worldGridAccessor: WorldGridAccessor;
    private gridCreateCallback = () => { return new Set<PlaceId>() }

    private placeDrawDistance = AppSettings.drawDistance.value;
    private lastUpdatePosition: Vector3;
    // TODO
    //private queuedPlaceUpdates: PlaceId[] = [];

    private subscription?: Subscription<OperationContent>;

    constructor(mount: HTMLCanvasElement, appControlfunctions: AppControlFunctions, walletProvider: ITezosWalletProvider) {
        this.appControlFunctions = appControlfunctions;
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
        this.engine = new Engine(canvas, AppSettings.enableAntialiasing.value);
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

        // create camera first
        this.playerController = new PlayerController(this, canvas, appControlfunctions);
        this.lastUpdatePosition = this.playerController.getPosition().clone();

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

        let loadedItemCache = new TransformNode("loadedItemCache", this.scene);
        loadedItemCache.position.y = -200;
        loadedItemCache.setEnabled(false);

        // create debug world
        //this.debugWorld();

        // TODO: this disable scene picking, but need to use onPointerDown, etc.
        /*this.scene.onPrePointerObservable.add((pointerInfo) => {
            pointerInfo.skipOnPointerObservable = true;
        });*/

        // After, camera, lights, etc, the shadow generator
        /*const csm = new CascadedShadowGenerator(1024, this.sunLight);
        //csm.debug = true;
        //csm.autoCalcDepthBounds = true;
        csm.depthClamp = true;
        csm.shadowMaxZ = 100;
        csm.freezeShadowCastersBoundingInfo = true;
        csm.splitFrustum();
        //this.shadowGenerator.autoCalcDepthBounds = true;
        //this.shadowGenerator.useExponentialShadowMap = true;
        //this.shadowGenerator.useBlurExponentialShadowMap = true;
        //this.shadowGenerator.usePoissonSampling = true;
        this.shadowGenerator = csm;*/

        if (AppSettings.enableShadows.value) {
            this.shadowGenerator = new ShadowGenerator(1024, this.sunLight);
            //this.shadowGenerator.autoCalcDepthBounds = true;
            this.shadowGenerator.useExponentialShadowMap = true;
            this.shadowGenerator.useBlurExponentialShadowMap = true;
            //this.shadowGenerator.usePoissonSampling = true;

            // set shadow generator on player controller.
            this.playerController.shadowGenerator = this.shadowGenerator;
        }
        else this.shadowGenerator = null;

        // Render every frame
        this.engine.runRenderLoop(() => {
            this.scene.render();
            const frameId = this.engine.frameId;
            if (divFps && frameId > 0 && frameId % 5 === 0)
                divFps.innerHTML = this.engine.getFps().toFixed() + " fps";
        });

        window.addEventListener('resize', this.onResize);

        this.scene.registerAfterRender(this.updateWorld.bind(this));

        this.registerPlacesSubscription();
    }

    private onResize = () => {
        this.engine.resize();
    }

    // TODO: move the subscription stuff into it's own class?
    private async registerPlacesSubscription() {
        this.subscription = await Contracts.subscribeToPlaceChanges(this.walletProvider);
        this.subscription?.on('data', this.placeSubscriptionCallback);
    }

    private unregisterPlacesSubscription() {
        this.subscription?.off("data", this.placeSubscriptionCallback);
        this.subscription = undefined;
    }

    private placeSubscriptionCallback = (d: OperationContent) => {
        Logging.InfoDev(d);
        const tContent = d as OperationContentsAndResultTransaction;

        if (tContent.parameters) {
            const ep = tContent.parameters.entrypoint;
            if (ep === "get_item" || ep === "place_items" || ep === "set_place_props" || ep === "remove_items") {
                try {
                    const schema = new ParameterSchema(Contracts.marketplaces!.entrypoints.entrypoints[ep])
                    const params = schema.Execute(tContent.parameters.value);

                    this.fetchPlace(params.lot_id.toNumber());
                }
                catch (e) {
                    Logging.InfoDev("Failed to parse parameters.");
                    Logging.InfoDev(e);
                }
            }
        }
    }

    public dispose() {
        window.removeEventListener('resize', this.onResize);
        
        this.unregisterPlacesSubscription();

        this.worldGrid.clear();
        this.places.clear();

        this.playerController.dispose();

        // Destorying the engine should prbably be enough.
        this.engine.dispose();
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
            this.shadowGenerator?.addShadowCaster(sphere);
        }

        var box = Mesh.CreateBox("sphere1", 2, this.scene);
        box.position.set(10, 1, 0);
        box.material = this.defaultMaterial;
        box.checkCollisions = true;
        this.shadowGenerator?.addShadowCaster(box);

        box = Mesh.CreateBox("sphere1", 2, this.scene);
        box.position.set(10, 3, 2);
        box.material = this.defaultMaterial;
        box.checkCollisions = true;
        this.shadowGenerator?.addShadowCaster(box);

        var player = Mesh.CreateBox("player", 1, this.scene);
        player.position.y = 10;
        player.checkCollisions = true;
        player.ellipsoid.set(0.5, 0.5, 0.5);
        this.shadowGenerator?.addShadowCaster(player);
    }

    // TODO: add a list of pending places to load.
    public async loadWorld() {
        const placeCount = (await Contracts.countPlacesView(this.walletProvider)).toNumber();

        Logging.InfoDev("world has " + placeCount + " places.");

        // Load all the places. Slowly.
        for(let i = 0; i < placeCount; ++i) {
            await this.fetchPlace(i);
        }

        // TEMP: workaround as long as loading owner and owned is delayed.
        const currentPlace = this.playerController.getCurrentPlace()
        if(currentPlace)
            this.appControlFunctions.updatePlaceInfo(currentPlace.placeId,
                currentPlace.currentOwner, currentPlace.isOwnedOrOperated);
    };

    // TODO: metadata gets re-loaded too often.
    // loadPlace should be definite. add another functio
    // that initially adds all places or soemthing.
    // Then go over this agiain.
    // distingquish between fetchPlace and loadPlace
    private async fetchPlace(placeId: PlaceId) {
        try {
            // If the place isn't in the grid yet, add it.
            var placeMetadata = await Metadata.getPlaceMetadata(placeId);
            if (placeMetadata === undefined) {
                Logging.InfoDev("No metadata for place: " + placeId);
                return;
            }

            const origin = Vector3.FromArray(placeMetadata.centerCoordinates);

            // Figure out by distance to player if the place should load.
            const player_pos = this.playerController.getPosition();
            if(player_pos.subtract(origin).length() < this.placeDrawDistance) {
                await this.loadPlace(placeId, placeMetadata);
            }

            // add to grid AFTER loading.
            const set = this.worldGrid.getOrAddA(this.worldGridAccessor, [origin.x, origin.z], this.gridCreateCallback);
            if(!set.has(placeId)) {
                set.add(placeId);
            }
        }
        catch(e) {
            Logging.InfoDev("Error fetching place: " + placeId);
            Logging.InfoDev(e);
            Logging.InfoDev(placeMetadata);
        }
    }

    private async loadPlace(placeId: PlaceId, placeMetadata: any) {
        if(this.places.has(placeId)) {
            // reload place
            this.places.get(placeId)!.loadItems(true);
        }
        else {
            const new_place = new Place(placeId, this);
            await new_place.load(placeMetadata);
            
            this.places.set(placeId, new_place);
        }
    }

    // TODO: go over this again.
    public updateWorld() {
        // Update world when player has moved a certain distance.
        const playerPos = this.playerController.getPosition();
        if(this.lastUpdatePosition.subtract(playerPos).length() > worldUpdateDistance)
        {
            // TEMP: do this asynchronously, getting lots of metadata
            // from storage is kinda slow.
            // TODO: Maybe have a position cache?
            (async () => {
                //const start_time = performance.now();
                this.lastUpdatePosition = playerPos.clone();

                // Check all loaded places for distance and remove.
                this.places.forEach((v, k) => {
                    // Multiply draw distance with small factor here to avoid imprecision and all that
                    if(playerPos.subtract(v.origin).length() > this.placeDrawDistance * 1.02) {
                        this.places.delete(k);
                        v.dispose();
                    }
                });

                // search coords in world
                const minWorld: Tuple = [playerPos.x - this.placeDrawDistance, playerPos.z - this.placeDrawDistance];
                const maxWorld: Tuple = [playerPos.x + this.placeDrawDistance, playerPos.z + this.placeDrawDistance];

                // search coords in cells
                const minCell = Grid2D.max([0, 0], this.worldGridAccessor.accessor(minWorld, this.worldGrid.getSize()));
                const maxCell = Grid2D.min(this.worldGrid.getSize(), this.worldGridAccessor.accessor(maxWorld, this.worldGrid.getSize()));

                // iterate over all places in all found cells and see if they need to be loaded.
                //var places_checked = 0;
                //var cells_checked = 0;
                for(let j = minCell[1]; j < maxCell[1]; ++j)
                    for(let i = minCell[0]; i < maxCell[0]; ++i) {
                        //cells_checked++;
                        const set = this.worldGrid.get([i, j])
                        if (set) {
                            set.forEach((id) => {
                                //places_checked++;
                                // early out if loaded
                                if(this.places.has(id)) return;
                                // maybe load, depending on distance
                                Metadata.getPlaceMetadata(id).then((placeMetadata) => {
                                    const origin = Vector3.FromArray(placeMetadata.centerCoordinates);
                                    if(playerPos.subtract(origin).length() < this.placeDrawDistance) {
                                        // todo: add to pending updates instead.
                                        this.loadPlace(id, placeMetadata);
                                    }
                                });
                            })
                        }
                    }

                //const elapsed_total = performance.now() - start_time;
                //Logging.InfoDev("updateWorld took " + elapsed_total.toFixed(2) + "ms");
                //Logging.InfoDev("checked cells: " + cells_checked);
                //Logging.InfoDev("checked places: " + places_checked);
            })();
        }
    }
}