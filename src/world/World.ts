import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { CascadedShadowGenerator } from "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { GridMaterial, SimpleMaterial, SkyMaterial } from "@babylonjs/materials";
import PlayerController from "../controllers/PlayerController";
import { Database, Material, Nullable, SceneLoader, TransformNode } from "@babylonjs/core";
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
import MultiplayerClient from "./MultiplayerClient";
import { disposeAssetMap } from "../ipfs/ipfs";
import SunLight from "./SunLight";
//import { isDev } from "../utils/Utils";


const worldUpdateDistance = 10;


export class World {
    readonly appControlFunctions: AppControlFunctions;
    readonly scene: Scene;
    
    private engine: Engine;
    private defaultMaterial: SimpleMaterial;
    readonly transparentGridMat: GridMaterial;
    
    private sunLight: SunLight;
    
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

    private multiClient?: MultiplayerClient | undefined;

    private subscription?: Subscription<OperationContent> | undefined;

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
        this.defaultMaterial.diffuseColor = new Color3(0.9, 0.9, 0.9);

        // transparent grid material for place bounds
        this.transparentGridMat = new GridMaterial("transp_grid", this.scene);
        this.transparentGridMat.opacity = 0.3;
        this.transparentGridMat.mainColor.set(0.2, 0.2, 0.8);
        this.transparentGridMat.lineColor.set(0.2, 0.8, 0.8);
        this.transparentGridMat.backFaceCulling = false;
        
        // Create sun and skybox
        const sun_direction = new Vector3(-50, -100, 50).normalize();
        this.sunLight = new SunLight("sunLight", sun_direction, this.scene);

        let ambient_light = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), this.scene);
        ambient_light.intensity = 0.3;
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
        skyMaterial.sunPosition = sun_direction.scale(-1);

        let skybox = Mesh.CreateBox("skyBox", 1000.0, this.scene);
        skybox.material = skyMaterial;

        // After, camera, lights, etc, the shadow generator
        if (AppSettings.shadowOptions.value === "standard") {
            const shadowGenerator = new ShadowGenerator(AppSettings.shadowMapRes.value, this.sunLight.light);
            shadowGenerator.frustumEdgeFalloff = 0.1;
            shadowGenerator.filter = ShadowGenerator.FILTER_PCSS;
            //shadowGenerator.useCloseExponentialShadowMap = true;
            //shadowGenerator.useExponentialShadowMap = true;
            //shadowGenerator.useBlurExponentialShadowMap = true;
            //shadowGenerator.usePoissonSampling = true;
            this.shadowGenerator = shadowGenerator;
        }
        else if (AppSettings.shadowOptions.value === "cascaded") {
            const shadowGenerator = new CascadedShadowGenerator(AppSettings.shadowMapRes.value, this.sunLight.light);
            //shadowGenerator.debug = true;
            //shadowGenerator.autoCalcDepthBounds = true;
            shadowGenerator.frustumEdgeFalloff = 0.1;
            shadowGenerator.freezeShadowCastersBoundingInfo = true;
            shadowGenerator.stabilizeCascades = true;
            shadowGenerator.shadowMaxZ = 150;
            shadowGenerator.numCascades = 4;
            shadowGenerator.lambda = 0.6;
            //shadowGenerator.splitFrustum();
            this.shadowGenerator = shadowGenerator;
        }
        else this.shadowGenerator = null;

        // set shadow generator on player controller.
        this.playerController.shadowGenerator = this.shadowGenerator;

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

        // TODO: on walletChanged event, disconnect and reconnect!
        this.multiClient = new MultiplayerClient(this);
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
        this.multiClient?.disconnectAndDispose();

        this.worldGrid.clear();
        this.places.clear();

        this.playerController.dispose();

        disposeAssetMap();

        // Destorying the engine should prbably be enough.
        this.engine.dispose();
    }

    // TODO: add a list of pending places to load.
    public async loadWorld() {
        const placeCount = (await Contracts.countPlacesView(this.walletProvider)).toNumber();

        Logging.InfoDev("world has " + placeCount + " places.");

        // Load all the places. Slowly.
        for(let i = 0; i < placeCount; ++i) {
            await this.fetchPlace(i);
        }

        this.loadRoadDecorations();

        // TEMP: workaround as long as loading owner and owned is delayed.
        const currentPlace = this.playerController.getCurrentPlace()
        if(currentPlace)
            this.appControlFunctions.updatePlaceInfo(currentPlace.placeId,
                currentPlace.currentOwner, currentPlace.isOwnedOrOperated);
    };

    private roadDecorations: Nullable<TransformNode> = null;

    // TODO: Needs to be culled!
    public async loadRoadDecorations() {
        const req = await fetch("/models/roads.json");
        const roadsAndCurbs = await req.json();

        this.roadDecorations = new TransformNode("roadDecorations", this.scene);

        const result = await SceneLoader.LoadAssetContainerAsync('/models/', 'lantern.glb', this.scene, null, '.glb');
        
        for (var curbEdge of roadsAndCurbs.curbs) {
            const from = new Vector3(curbEdge.a.x, 0, curbEdge.a.y);
            const to = new Vector3(curbEdge.b.x, 0, curbEdge.b.y);

            const line = from.subtract(to);
            const line_len = line.length();
            if(line_len > 13) {
                //const lineMesh = Mesh.CreateLines("line", [from, to], this.scene, false);
                
                for (var d = 6.5; d < line_len - 6.5; d = d + 25) {
                    const instance = result.instantiateModelsToScene().rootNodes[0];
                    instance.position = to.add(line.scale(d / line_len));
                    instance.parent = this.roadDecorations;
                    this.shadowGenerator?.addShadowCaster(instance as Mesh);
                }
            }
        }
    }

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

    private lastMultiplayerUpdate: number = 0;

    private updateMultiplayer() {
        if(this.multiClient && this.multiClient.connected) {
            // Occasionally send on postition.
            const now = performance.now();
            const elapsed = now - this.lastMultiplayerUpdate;
            if(elapsed > MultiplayerClient.UpdateInterval) {
                this.lastMultiplayerUpdate = now;

                this.multiClient.updatePlayerPosition(
                    this.playerController.getPosition(),
                    this.playerController.getRotation()
                );
            }

            // interpolate other players
            this.multiClient.interpolateOtherPlayers();
        }
    }

    // TODO: go over this again.
    public updateWorld() {
        const playerPos = this.playerController.getPosition();

        this.sunLight.update(playerPos);

        // update multiplayer
        this.updateMultiplayer();

        // Update world when player has moved a certain distance.
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