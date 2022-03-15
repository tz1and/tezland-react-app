import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Vector2, Axis, Space, Angle } from "@babylonjs/core/Maths/math";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { CascadedShadowGenerator } from "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { GridMaterial, SimpleMaterial, SkyMaterial, WaterMaterial } from "@babylonjs/materials";
import PlayerController from "../controllers/PlayerController";
import { Database, MeshBuilder, Nullable, SceneLoader, Texture, TransformNode } from "@babylonjs/core";
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
import { MeshUtils } from "../utils/MeshUtils";
import { WorldDefinition } from "../worldgen/WorldGen";
import { isDev } from "../utils/Utils";
import assert from "assert";
import { Edge } from "../worldgen/WorldPolygon";


const worldUpdateDistance = 10;


export class World {
    readonly appControlFunctions: AppControlFunctions;
    readonly scene: Scene;
    
    private engine: Engine;
    private defaultMaterial: SimpleMaterial;
    private waterMaterial: WaterMaterial;
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

    constructor(mount: HTMLCanvasElement, appControlFunctions: AppControlFunctions, walletProvider: ITezosWalletProvider) {
        this.appControlFunctions = appControlFunctions;
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
        if(isDev()) {
            import("@babylonjs/inspector").then( () => {
                const inspector_root = document.getElementById("inspector-host");
                assert(inspector_root);
                this.scene.debugLayer.show({ showExplorer: true, embedMode: true, globalRoot: inspector_root });
            });
        }

        // create camera first
        this.playerController = new PlayerController(this, canvas, appControlFunctions);
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

        const ambient_light = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), this.scene);
        ambient_light.intensity = 0.3;
        ambient_light.diffuse = new Color3(0.7, 0.7, 1);
        ambient_light.specular = new Color3(1, 1, 0.7);
        ambient_light.groundColor = new Color3(1, 1, 0.7);

        const skyMaterial = new SkyMaterial("skyMaterial", this.scene);
        skyMaterial.backFaceCulling = false;
        //skyMaterial.inclination = 0.25;
        //skyMaterial.turbidity = 1;
        //skyMaterial.rayleigh = 3;
        //skyMaterial.luminance = 0.3;
        skyMaterial.useSunPosition = true;
        skyMaterial.sunPosition = sun_direction.scale(-1);

        let skybox = Mesh.CreateBox("skyBox", 1000.0, this.scene);
        skybox.material = skyMaterial;

        // The worlds water.
        const waterMaterial = new WaterMaterial("water", this.scene, new Vector2(512, 512));
        waterMaterial.backFaceCulling = true;
        const bumpTexture = new Texture("models/waterbump.png", this.scene);
        bumpTexture.uScale = 2;
        bumpTexture.vScale = 2;
        waterMaterial.bumpTexture = bumpTexture;
        waterMaterial.windForce = -1;
        waterMaterial.waveHeight = 0; //0.05;
        waterMaterial.bumpHeight = 0.15;
        waterMaterial.windDirection = new Vector2(1, 1);
        waterMaterial.waterColor = new Color3(0.02, 0.06, 0.24);
        waterMaterial.colorBlendFactor = 0.7;
        waterMaterial.addToRenderList(skybox);
        this.waterMaterial = waterMaterial

        const water = Mesh.CreateGround("water", 1000, 1000, 4, this.scene);
        water.material = this.waterMaterial;
        water.isPickable = false;
        water.checkCollisions = true;
        water.receiveShadows = true;
        water.position.y = -3;

        // After, camera, lights, etc, the shadow generator
        if (AppSettings.shadowOptions.value === "standard") {
            const shadowGenerator = new ShadowGenerator(AppSettings.shadowMapRes.value, this.sunLight.light);
            shadowGenerator.frustumEdgeFalloff = 0.1;
            shadowGenerator.filter = ShadowGenerator.FILTER_PCSS;
            // Self-shadow bias
            shadowGenerator.bias = 0.001;
            shadowGenerator.normalBias = 0.02;
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
            shadowGenerator.shadowMaxZ = 250;
            shadowGenerator.numCascades = 4;
            shadowGenerator.lambda = 0.6;
            // Self-shadow bias
            shadowGenerator.bias = 0.001;
            shadowGenerator.normalBias = 0.02;
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

        // TODO: wait for wallet to be initialised?

        //new UniversalCamera("testCam", new Vector3(0,2,-10), this.scene);
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
            if (ep === "get_item" || ep === "place_items" || ep === "set_place_props" || ep === "remove_items" || ep === "set_item_data") {
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
        // Load districts
        await this.loadDistricts();

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
                currentPlace.currentOwner, currentPlace.getPermissions);
    };

    private async loadDistricts() {
        const req = await fetch("/models/districts.json");
        const world_def = (await req.json()) as WorldDefinition;

        let counter = 0;
        for (const district of world_def.districts) {
            const center = new Vector3(district.center.x, 0, district.center.y);
            let vertices: Vector3[] = [];

            district.vertices.forEach((vertex) => {
                vertices.push(new Vector3(vertex.x, 0, vertex.y));
            });
            vertices = vertices.reverse()

            // Create "island".
            const mesh = MeshUtils.extrudeMeshFromShape(vertices, 50, center, this.defaultMaterial,
                `district${counter}`, this.scene, Mesh.DEFAULTSIDE, true);
            mesh.checkCollisions = true;
            mesh.receiveShadows = true;
            mesh.position.y = -0.01;

            this.waterMaterial.addToRenderList(mesh);

            // TODO: gaps for bridges.
            // Create invisible wall.
            /*const walls = MeshUtils.extrudeShape([new Vector3(), new Vector3(0,2,0)], vertices, center, this.defaultMaterial,
                `district${counter}`, this.scene, Mesh.BACKSIDE);
            walls.checkCollisions = true;
            walls.receiveShadows = false;
            walls.visibility = 0;*/

            this.loadRoadDecorations(district.curbs, counter);

            counter++;
        }

        counter = 0;
        for (const bridge of world_def.bridges) {
            let points: Vector3[] = [];

            bridge.bridge_path.forEach((vertex) => {
                points.push(new Vector3(vertex.x, 0, vertex.y));
            });

            const bridgeNode = new TransformNode(`bridge${counter}`, this.scene);

            // For now, bridge paths can only be a line
            const bridge_width = 8;
            const bridge_vector = points[1].subtract(points[0]);
            const bridge_length = bridge_vector.length() + 2;
            //const half_bridge_length = bridge_length * 0.5;
            const bridge_pos = points[0].add(points[1]).multiplyByFloats(0.5, 0.5, 0.5);
            const bridge_angle = Vector3.Dot(Vector3.Forward(), bridge_vector.normalize());

            const walkway0 = MeshBuilder.CreateBox("walkway0", {
                width: bridge_width,
                depth: bridge_length,
                height: 1,
            }, this.scene);
            walkway0.checkCollisions = true;
            walkway0.isPickable = true;
            walkway0.receiveShadows = true;
            walkway0.parent = bridgeNode;
            this.shadowGenerator?.addShadowCaster(walkway0);
            
            /*const walkway0 = MeshBuilder.CreateBox("walkway0", {
                width: bridge_width,
                depth: half_bridge_length + 0.02,
                height: 1,
            }, this.scene);
            walkway0.checkCollisions = true;
            walkway0.isPickable = true;
            walkway0.receiveShadows = true;
            walkway0.parent = bridgeNode;
            walkway0.position.z = bridge_length*0.25;
            walkway0.position.y = 0.075;
            walkway0.rotate(Axis.X, 0.02, Space.LOCAL);
            this.shadowGenerator?.addShadowCaster(walkway0);

            const walkway1 = MeshBuilder.CreateBox("walkway0", {
                width: bridge_width,
                depth: half_bridge_length + 0.02,
                height: 1,
            }, this.scene);
            walkway1.checkCollisions = true;
            walkway1.isPickable = true;
            walkway1.parent = bridgeNode;
            walkway1.receiveShadows = true;
            walkway1.position.z = -bridge_length*0.25;
            walkway1.position.y = 0.075;
            walkway1.rotate(Axis.X, -0.02, Space.LOCAL);
            this.shadowGenerator?.addShadowCaster(walkway1);*/

            // For now, bridge paths can only be a line
            const left = MeshBuilder.CreateBox("wall0", {
                width: 1,
                depth: bridge_length,
                height: 2,
            }, this.scene);
            left.checkCollisions = true;
            left.isPickable = true;
            left.parent = bridgeNode;
            left.position.set(-bridge_width/2 - 0.5, 0.5, 0);
            this.shadowGenerator?.addShadowCaster(left);

            const right = MeshBuilder.CreateBox("wall1", {
                width: 1,
                depth: bridge_length,
                height: 2,
            }, this.scene);
            right.checkCollisions = true;
            right.isPickable = true;
            right.parent = bridgeNode;
            right.position.set(bridge_width/2 + 0.5, 0.5, 0);
            this.shadowGenerator?.addShadowCaster(right);

            bridgeNode.position = bridge_pos;
            bridgeNode.position.y = -0.511;

            bridgeNode.rotate(Axis.Y, Angle.FromDegrees(90).radians() + bridge_angle, Space.LOCAL);

            counter++;
        }
    }

    //private roadDecorations: Nullable<TransformNode> = null;

    // TODO: Needs to be culled!
    public async loadRoadDecorations(curbs: Edge[], counter: number) {
        const roadDecorations = new TransformNode(`roadDecorations${counter}`, this.scene);

        // TODO: don't load this multiple times
        const result = await SceneLoader.LoadAssetContainerAsync('/models/', 'lantern.glb', this.scene, null, '.glb');
        result.meshes.forEach((m) => { m.checkCollisions = true; })
        
        for (var curbEdge of curbs) {
            const from = new Vector3(curbEdge.a.x, 0, curbEdge.a.y);
            const to = new Vector3(curbEdge.b.x, 0, curbEdge.b.y);

            const line = from.subtract(to);
            const line_len = line.length();
            if(line_len > 13) {
                //const lineMesh = Mesh.CreateLines("line", [from, to], this.scene, false);
                
                for (var d = 6.5; d < line_len - 6.5; d = d + 25) {
                    const instance = result.instantiateModelsToScene().rootNodes[0];
                    instance.position = to.add(line.scale(d / line_len));
                    instance.parent = roadDecorations;
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
            // Occasionally send player postition.
            const now = performance.now();
            const elapsed = now - this.lastMultiplayerUpdate;
            if(!this.playerController.flyMode && elapsed > MultiplayerClient.UpdateInterval) {
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