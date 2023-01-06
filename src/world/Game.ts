import { DefaultRenderingPipeline, Engine, Scene,
    TonemappingOperator, Nullable, Color3, HighlightLayer, Mesh, Vector3 } from "@babylonjs/core";
import assert from "assert";
import { ITezosWalletProvider } from "../components/TezosWalletContext";
import PlayerController from "../controllers/PlayerController";
import AppSettings from "../storage/AppSettings";
import ArtifactMemCache from "../utils/ArtifactMemCache";
import { Logging } from "../utils/Logging";
import { AppControlFunctions } from "./AppControlFunctions";
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


export class Game {
    readonly walletProvider: ITezosWalletProvider;
    readonly engine: Engine;
    readonly scene: Scene;

    private highlightLayer: HighlightLayer;

    readonly appControlFunctions: AppControlFunctions;

    readonly defaultMaterial: SimpleMaterial;
    readonly transparentGridMat: GridMaterial;

    readonly playerController: PlayerController;

    private cleanupInterval: number;

    readonly onchainQueue; // For onchain views.
    readonly loadingQueue; // For loading items.

    private world: Nullable<BaseWorld> = null;

    constructor(engine: Engine, appControlFunctions: AppControlFunctions, walletProvider: ITezosWalletProvider) {
        this.appControlFunctions = appControlFunctions;
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
        this.playerController = new PlayerController(this, appControlFunctions);

        // TODO: need to figure out how to exclude GUI.
        //this.setupDefaultRenderingPipeline();

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
            ArtifactMemCache.cleanup();
            this.scene.cleanCachedTextureBuffer();
        }, 60000);

        ArtifactMemCache.initialise().then(() => {
            const location = this.getSpwanLocation();
            this.teleportTo(location);
        });
    }

    public dispose() {
        // Hide inspector in dev
        if(import.meta.env.DEV) this.scene.debugLayer.hide();

        //this.walletProvider.walletEvents().removeListener("walletChange", this.reconnectMultiplayer);
        window.removeEventListener('resize', this.onResize);

        this.world?.dispose();
        this.world = null;
        
        /*this.unregisterPlacesSubscription();
        this.multiClient?.disconnectAndDispose();

        this.places.clear();*/

        this.playerController.dispose();

        // Clear queues.
        this.onchainQueue.clear();
        this.loadingQueue.clear();

        // Dispose assets and processing queues.
        window.clearInterval(this.cleanupInterval);
        ArtifactMemCache.dispose();

        // Destorying the engine should prbably be enough.
        this.engine.dispose();
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

        if (location.pos || location.district) {
            this.switchWorld(World, location);
        }

        if (location.placeKey) {
            if (location.placeKey.fa2 === Conf.interior_contract) {
                this.switchWorld(InteriorWorld, undefined, location.placeKey.id);
            }
            else { //if (location.placeKey.fa2 === Conf.place_contract) {
                this.switchWorld(World, location);
            }
        }
    }

    private switchWorld(toWorldType: new(game: Game) => World | InteriorWorld, location?: WorldLocation, placeId?: number) {
        // If teleport from exterior to exterior, don't destroy world.
        if (this.world && this.world instanceof World && toWorldType === World) {
            // TODO: await teleportToLocal?
            if(location) this.playerController.teleportToLocal(location);
        }
        else {
            this.world?.dispose();
            this.world = new toWorldType(this);

            // TODO: await teleportToLocal?
            if (location) {
                this.playerController.teleportToLocal(location);
            }
            else {
                this.playerController.teleportToLocal(new WorldLocation({
                    pos: new Vector3(0, 0, 0)
                }));
            }

            if (this.world instanceof InteriorWorld) {
                Logging.InfoDev("Switching world to InteriorWorld");
                assert(placeId !== undefined, "placeId is undefined");
                this.world.loadWorld(new PlaceKey(placeId, Conf.interior_contract)).catch(e => {});
            }
            else if (this.world instanceof World) {
                Logging.InfoDev("Switching world to World");
                this.world.loadWorld().catch(e => {});
            }
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
            pipeline.samples = 4;
        }

        if (AppSettings.enableFxaa.value) {
            pipeline.fxaaEnabled = true;
        }

        // NOTE: let's not do bloom for now, because it blooms the UI too.
        if (AppSettings.enableBloom.value) {
            pipeline.bloomEnabled = true;
            // TODO: find some nice settings.
            //pipeline.bloomThreshold = 0.8;
            //pipeline.bloomWeight = 0.3;
            //pipeline.bloomKernel = 64;
            //pipeline.bloomScale = 0.5;
        }

        // Maybe have it under some "other postprocessing" option
        if (true) {
            pipeline.imageProcessingEnabled = true;

            pipeline.imageProcessing.toneMappingEnabled = true;
            pipeline.imageProcessing.toneMappingType = TonemappingOperator.Photographic;
            pipeline.imageProcessing.exposure = 1.05;

            if (AppSettings.enableGrain.value) {
                pipeline.grainEnabled = true;
                pipeline.grain.intensity = 4;
                pipeline.grain.animated = true;
            }
        }

        // NOTE: SSAO2 is kinda broken right now.
        /*var ssaoRatio = {
            ssaoRatio: 0.5, // Ratio of the SSAO post-process, in a lower resolution
            blurRatio: 0.5// Ratio of the combine post-process (combines the SSAO and the scene)
        };

        var ssao = new SSAO2RenderingPipeline("ssao", this.scene, ssaoRatio, undefined, false);
        ssao.radius = 5;
        ssao.totalStrength = 1.3;
        ssao.expensiveBlur = false;
        ssao.samples = 16;
        ssao.maxZ = 250;

        // Attach camera to the SSAO render pipeline
        this.scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", this.playerController.camera);*/
    }
}