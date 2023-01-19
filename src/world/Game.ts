import { DefaultRenderingPipeline, Engine, Scene,
    Nullable, Color3, HighlightLayer, Mesh, Vector3, TonemappingOperator, TransformNode } from "@babylonjs/core";
import assert from "assert";
import { ITezosWalletProvider } from "../components/TezosWalletContext";
import PlayerController from "../controllers/PlayerController";
import AppSettings from "../storage/AppSettings";
import ArtifactMemCache from "../utils/ArtifactMemCache";
import { Logging } from "../utils/Logging";
import { World } from "./World";
import { BaseWorld } from "./BaseWorld";
import PQueue from "p-queue";
import { InteriorWorld } from "./InteriorWorld";
import { GridMaterial, SimpleMaterial } from "@babylonjs/materials";
import Conf from "../Config";
import ItemNode from "./nodes/ItemNode";
import PlaceKey from "../utils/PlaceKey";
import WorldLocation from "../utils/WorldLocation";
import { UrlLocationParser } from "../utils/UrlLocationParser";
import MultiplayerClient from "./MultiplayerClient";


export class Game {
    readonly walletProvider: ITezosWalletProvider;
    readonly engine: Engine;
    readonly scene: Scene;

    private highlightLayer: HighlightLayer;

    readonly defaultMaterial: SimpleMaterial;
    readonly transparentGridMat: GridMaterial;

    readonly playerController: PlayerController;
    private _multiClient: MultiplayerClient;
    public get multiClient() { return this._multiClient; }

    private cleanupInterval: number;

    readonly onchainQueue; // For onchain views.
    readonly loadingQueue; // For loading items.

    private world: Nullable<BaseWorld> = null;

    private group: TransformNode;

    constructor(engine: Engine, walletProvider: ITezosWalletProvider) {
        this.engine = engine;
        this.walletProvider = walletProvider;

        this.onchainQueue = new PQueue({concurrency: 1, interval: 125, intervalCap: 1});
        this.loadingQueue = new PQueue({interval: 1000/120, intervalCap: 1}); // {concurrency: 100} //, interval: 1/60, intervalCap: 1});

        // Set max texture res
        const caps = this.engine.getCaps();
        caps.maxTextureSize = Math.min(caps.maxTextureSize, AppSettings.textureRes.value);

        // Create our first scene.
        this.scene = new Scene(this.engine, {
            useGeometryUniqueIdsMap: true,
            useMaterialMeshMap: true,
            useClonedMeshMap: true
        });
        this.scene.collisionsEnabled = true;
        this.scene.blockMaterialDirtyMechanism = true;

        // Not sure if this is right, but let's assume it is.
        // TODO: See this issue
        // https://forum.babylonjs.com/t/scene-ready-observable-not-firing-with-v5-35-0/36166/17
        this.scene.freezeActiveMeshes();

        // Fog is currently needed for underwater.
        this.scene.fogMode = Scene.FOGMODE_EXP;
        //scene.fogStart = 5;
        //scene.fogEnd = 100;
        this.scene.fogColor = BaseWorld.FogSettings.color;
        this.scene.fogDensity = BaseWorld.FogSettings.density;

        this.highlightLayer = new HighlightLayer("portalHl", this.scene);

        // Enable inspector in dev
        if (import.meta.env.DEV) {
            import("@babylonjs/inspector").then( () => {
                const inspector_root = document.getElementById("inspector-host");
                assert(inspector_root);
                this.scene.debugLayer.show({ showExplorer: true, embedMode: true, globalRoot: inspector_root });
            });
        }

        // Create a default material
        this.defaultMaterial = new SimpleMaterial("defaulDistrictMat", this.scene);
        this.defaultMaterial.diffuseColor = new Color3(0.9, 0.9, 0.9);

        // transparent grid material for place bounds
        this.transparentGridMat = new GridMaterial("transp_grid", this.scene);
        this.transparentGridMat.opacity = 0.3;
        this.transparentGridMat.mainColor.set(0.2, 0.2, 0.8);
        this.transparentGridMat.lineColor.set(0.2, 0.8, 0.8);
        this.transparentGridMat.backFaceCulling = false;

        // create camera first
        this.playerController = new PlayerController(this);

        this.group = new TransformNode("assets");
        this.group.setEnabled(false);
        this.group.position.y = -50;

        // TODO: need to figure out how to exclude GUI.
        this.setupDefaultRenderingPipeline();

        // Render every frame
        this.engine.stopRenderLoop();
        this.engine.runRenderLoop(() => {
            this.scene.render();
            const frameId = this.engine.frameId;
            if (frameId > 0 && frameId % 5 === 0)
                this.playerController.gui.setFps(this.engine.getFps());
        });

        window.addEventListener('resize', this.onResize);

        // Run asset cleanup once every minute.
        this.cleanupInterval = window.setInterval(() => {
            Logging.Info("Running asset cleanup")
            ArtifactMemCache.cleanup(this.scene);
            this.scene.cleanCachedTextureBuffer();
        }, 60000);

        ArtifactMemCache.initialise(this.group).then(() => {
            const location = this.getSpwanLocation();
            this.teleportTo(location);
        });

        this._multiClient = new MultiplayerClient(this);
        this.walletProvider.walletEvents().addListener("walletChange", this.updateMultiplayerIdentity);
    }

    private updateMultiplayerIdentity = () => {
        this._multiClient.updatePlayerIdentity();
    }

    public dispose() {
        // Hide inspector in dev
        if(import.meta.env.DEV) this.scene.debugLayer.hide();

        this.walletProvider.walletEvents().removeListener("walletChange", this.updateMultiplayerIdentity);
        window.removeEventListener('resize', this.onResize);
        window.clearInterval(this.cleanupInterval);

        this.world?.dispose();
        this.world = null;
        
        this.multiClient.dispose();

        this.playerController.dispose();

        // Clear queues.
        this.onchainQueue.clear();
        this.loadingQueue.clear();

        // Dispose assets and processing queues.
        ArtifactMemCache.dispose().finally(() => {
            // Babylon needs to be destroyed after the worker threads.
            // I THINK!
            Logging.InfoDev("Disposing Babylon");
            this.engine.dispose();
        });
    }

    private onResize = () => {
        this.engine.resize();
    }

    public getWorldLimits(): { triangleLimit: number, fileSizeLimit: number } {
        assert(this.world);

        if (this.world instanceof World)
            return { triangleLimit: AppSettings.triangleLimit.value, fileSizeLimit: AppSettings.fileSizeLimit.value };
        else
            return { triangleLimit: AppSettings.triangleLimitInterior.value, fileSizeLimit: AppSettings.fileSizeLimitInterior.value };
    }

    public getCurrentWorld(): Nullable<BaseWorld> {
        return this.world;
    }

    public teleportTo(location: WorldLocation) {
        assert(location.isValid(), "Invalid location");

        if (location.absoluteLocationOrDistrict()) {
            this.switchWorld(World, location);
        }
        else if (location.placeKey) {
            if (location.placeKey.fa2 === Conf.interior_contract) {
                this.switchWorld(InteriorWorld, location, location.placeKey.id);
            }
            else { //if (location.placeKey.fa2 === Conf.place_contract) {
                this.switchWorld(World, location);
            }
        }
        else {
            throw new Error(`Unhandled teleport location: ${location}`);
        }
    }

    private switchWorld(toWorldType: new(game: Game) => World | InteriorWorld, location: WorldLocation, placeId?: number) {
        // If teleport from exterior to exterior, don't destroy world.
        if (this.world && this.world instanceof World && toWorldType === World) {
            this.playerController.teleportToLocal(location);
        }
        else {
            this.world?.dispose();
            this.world = new toWorldType(this);
            //assert(this.world, "World is null");

            if (this.world instanceof InteriorWorld) {
                Logging.InfoDev("Switching world to InteriorWorld");
                // If the location has a position attached, teleport to that position
                if (location.pos) {
                    this.playerController.teleportToLocal(new WorldLocation({pos: location.pos}));
                }
                // Else, teleport to Interior origin.
                else {
                    this.playerController.teleportToLocal(new WorldLocation({
                        pos: new Vector3(0, 0, 0)
                    }));
                }

                assert(placeId !== undefined, "placeId is undefined");
                this.world.setPlaceKey(new PlaceKey(placeId, Conf.interior_contract));
            }
            else if (this.world instanceof World) {
                Logging.InfoDev("Switching world to World");
                // Teleport player to desired world location.
                this.playerController.teleportToLocal(location);
            }

            this.world.loadWorld();
        }
    }

    public getSpwanLocation(): WorldLocation {
        let location: WorldLocation | undefined;
        try {
            location = UrlLocationParser.parseLocationFromUrl();
        } catch(e) {
            Logging.Error("Failed to parse location from URL:", e);
        }

        if (!location) {
            if (AppSettings.defaultSpawn.value.fa2 === "district")
                location = new WorldLocation({district: AppSettings.defaultSpawn.value.id});
            else
                location = new WorldLocation({placeKey: AppSettings.defaultSpawn.value});
        }

        return location;
    }

    public addItemToHighlightLayer(node: ItemNode) {
        node.getChildMeshes().forEach((mesh) => {
            if (mesh instanceof Mesh) this.highlightLayer.addMesh(mesh, Color3.FromHexString('#2d81b3'));
        });
    }

    private setupDefaultRenderingPipeline() {
        var pipeline = new DefaultRenderingPipeline(
            "defaultPipeline", // The name of the pipeline
            false, // NOTE: HDR messes with the brightness. maybe adding tonemapping helps?
            this.scene, // The scene instance
            [this.playerController.camera] // The list of cameras to be attached to
        );

        if (AppSettings.enableAntialiasing.value) {
            pipeline.samples = 2;
        }

        if (AppSettings.enableFxaa.value) {
            pipeline.fxaaEnabled = true;
        }

        // NOTE: let's not do bloom for now.
        /*if (AppSettings.enableBloom.value) {
            pipeline.bloomEnabled = true;
            pipeline.bloomThreshold = 0.0;
            pipeline.bloomWeight = 0.05;
            pipeline.bloomKernel = 64;
            pipeline.bloomScale = 0.25;
        }*/

        // Maybe have it under some "other postprocessing" option
        if (true) {
            pipeline.imageProcessingEnabled = true;

            /*const curve = new ColorCurves();
            curve.shadowsHue = 0;
            curve.shadowsDensity = 50;

            curve.midtonesHue = 300;
            curve.midtonesDensity = 35;

            curve.highlightsHue = 240;
            curve.highlightsDensity = 25;
            curve.highlightsExposure = 75;

            pipeline.imageProcessing.colorCurvesEnabled = true;
            pipeline.imageProcessing.colorCurves = curve;*/

            pipeline.imageProcessing.toneMappingEnabled = true;
            pipeline.imageProcessing.toneMappingType = TonemappingOperator.Photographic;
            pipeline.imageProcessing.exposure = 1.0;

            pipeline.imageProcessing.ditheringEnabled = true;
            pipeline.imageProcessing.ditheringIntensity = 1 / 255;

            if (AppSettings.enableGrain.value) {
                pipeline.grainEnabled = true;
                pipeline.grain.intensity = 2;
                pipeline.grain.animated = true;
            }
        }

        // NOTE: SSAO2 is kinda broken right now.
        /*var ssaoRatio = {
            ssaoRatio: 1.0, // Ratio of the SSAO post-process, in a lower resolution
            blurRatio: 1.0// Ratio of the combine post-process (combines the SSAO and the scene)
        };

        var ssao = new SSAO2RenderingPipeline("ssao", this.scene, ssaoRatio, [this.playerController.camera], false);
        ssao.radius = 2;
        ssao.totalStrength = 1;
        ssao.expensiveBlur = false;
        ssao.samples = 8;
        //ssao.maxZ = 250;

        // Attach camera to the SSAO render pipeline
        //this.scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", this.playerController.camera);*/
    }
}