import { Vector3, Color3, HemisphericLight,
    ShadowGenerator, CascadedShadowGenerator, Mesh,
    AbstractMesh, Nullable, ReflectionProbe,
    RenderTargetTexture, TransformNode } from "@babylonjs/core";
import { SkyMaterial } from "@babylonjs/materials";
import { PlaceId } from "./nodes/BasePlaceNode";
import InteriorPlaceNode from "./nodes/InteriorPlaceNode";
import Metadata, { PlaceTokenMetadata } from "./Metadata";
import AppSettings from "../storage/AppSettings";
import Contracts from "../tz/Contracts";
import { Logging } from "../utils/Logging";
import { OperationContent, Subscription } from "@taquito/taquito";
import { OperationContentsAndResultTransaction } from '@taquito/rpc'
import { ParameterSchema } from '@taquito/michelson-encoder'
import MultiplayerClient from "./MultiplayerClient";
import SunLight from "./nodes/SunLight";
import assert from "assert";
import ArtifactMemCache from "../utils/ArtifactMemCache";
import { BaseWorld } from "./BaseWorld";
import ArtifactProcessingQueue from "../utils/ArtifactProcessingQueue";
import { Game } from "./Game";


const worldUpdateDistance = 10; // in m
const shadowListUpdateInterval = 2000; // in ms


export class InteriorWorld extends BaseWorld {
    private worldNode: TransformNode;

    private sunLight: SunLight;
    private skybox: Mesh;
    
    readonly shadowGenerator: Nullable<ShadowGenerator>;

    private lastUpdatePosition: Vector3;
    private worldUpdatePending: boolean = false;

    private multiClient?: MultiplayerClient | undefined;

    private subscription?: Subscription<OperationContent> | undefined;

    private place: Nullable<InteriorPlaceNode> = null;

    constructor(game: Game) {
        super(game);

        this.lastUpdatePosition = this.game.playerController.getPosition().clone();

        this.worldNode = new TransformNode("worldNode", this.game.scene);
        
        // Create sun and skybox
        const sun_direction = new Vector3(-50, -100, 50).normalize();
        this.sunLight = new SunLight("sunLight", sun_direction, this.game.scene);
        this.sunLight.parent = this.worldNode;

        const ambient_light = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), this.game.scene);
        ambient_light.intensity = 0.25;
        ambient_light.diffuse = new Color3(0.7, 0.7, 1);
        ambient_light.specular = new Color3(1, 1, 0.7);
        ambient_light.groundColor = new Color3(1, 1, 0.7);
        ambient_light.parent = this.worldNode;

        const skyMaterial = new SkyMaterial("skyMaterial", this.game.scene);
        skyMaterial.backFaceCulling = false;
        //skyMaterial.inclination = 0.25;
        //skyMaterial.turbidity = 1;
        //skyMaterial.rayleigh = 3;
        //skyMaterial.luminance = 0.3;
        skyMaterial.useSunPosition = true;
        skyMaterial.sunPosition = sun_direction.scale(-1);

        this.skybox = Mesh.CreateBox("skyBox", 1000.0, this.game.scene);
        this.skybox.material = skyMaterial;
        this.skybox.parent = this.worldNode;

        // reflection probe
        let reflectionProbe = new ReflectionProbe('reflectionProbe', 256, this.game.scene);
        assert(reflectionProbe.renderList);
        reflectionProbe.renderList.push(this.skybox);
        reflectionProbe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
        this.game.scene.environmentTexture = reflectionProbe.cubeTexture;

        const ground = Mesh.CreateGround("water", 2000, 2000, 4, this.game.scene);
        ground.material = this.game.defaultMaterial;
        ground.isPickable = true;
        ground.checkCollisions = true;
        ground.receiveShadows = true;
        ground.position.y = -0.01;
        ground.parent = this.worldNode;

        // After, camera, lights, etc, the shadow generator
        // TODO: shadow generator should be BaseWorld!
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

        if(this.shadowGenerator) {
            let rtt = this.shadowGenerator.getShadowMap();

            if(rtt) {
                Logging.InfoDev("Setting up custom render list for shadow generator")
                rtt.getCustomRenderList = (layer, renderList, renderListLength) => {
                    if (!renderList) return renderList;

                    return this.shadowRenderList;
                };
            }
        }

        this.game.scene.registerBeforeRender(this.updateShadowRenderList);
        this.game.scene.registerAfterRender(this.updateWorld);

        this.registerPlacesSubscription();

        // Delay start MultiplayerClient.
        setTimeout(() => {
            this.multiClient = new MultiplayerClient(this.game);
            this.game.walletProvider.walletEvents().addListener("walletChange", this.reconnectMultiplayer);
        }, 500);

        //new UniversalCamera("testCam", new Vector3(0,2,-10), this.scene);
    }

    private reconnectMultiplayer = () => {
        this.multiClient?.disconnectAndDispose();
        this.multiClient = new MultiplayerClient(this.game);
    }

    // TODO: move the subscription stuff into it's own class?
    private async registerPlacesSubscription() {
        this.subscription = await Contracts.subscribeToPlaceChanges(this.game.walletProvider, "interior");
        this.subscription?.on('data', this.placeSubscriptionCallback);
    }

    private unregisterPlacesSubscription() {
        this.subscription?.off("data", this.placeSubscriptionCallback);
        this.subscription = undefined;
    }

    private placeSubscriptionCallback = (d: OperationContent) => {
        Logging.InfoDev(d);
        const tContent = d as OperationContentsAndResultTransaction;

        // NOTE: might break with internal contract calls!
        if (tContent.parameters) {
            const ep = tContent.parameters.entrypoint;
            if (ep === "get_item" || ep === "place_items" || ep === "set_place_props" || ep === "remove_items" || ep === "set_item_data") {
                try {
                    const schema = new ParameterSchema(Contracts.worldInteriorsContract!.entrypoints.entrypoints[ep])
                    const params = schema.Execute(tContent.parameters.value);

                    // Reload place if out interior canged.
                    if (this.place && this.place.placeId === params.lot_id.toNumber())
                        this.reloadPlace();
                }
                catch (e) {
                    Logging.InfoDev("Failed to parse parameters.");
                    Logging.InfoDev(e);
                }
            }
        }
    }

    public dispose() {
        this.game.walletProvider.walletEvents().removeListener("walletChange", this.reconnectMultiplayer);

        this.game.scene.unregisterBeforeRender(this.updateShadowRenderList);
        this.game.scene.unregisterAfterRender(this.updateWorld);
        
        this.unregisterPlacesSubscription();
        this.multiClient?.disconnectAndDispose();

        this.worldNode.dispose();
    }

    // TODO: add a list of pending places to load.
    public async loadWorld() {
        this.worldUpdatePending = true;

        // Batch load all (un)loaded places metadata and return
        const place_metadata = await Metadata.getPlaceMetadata(3, "interior");
        assert(place_metadata);

        await this.loadPlace(place_metadata);

        // We only need to set the place once for interiors.
        this.updateCurrentPlace();

        this.worldUpdatePending = false;
    };

    private async reloadPlace() {
        // Queue a place update.
        const place = this.place;
        if (place) this.game.onchainQueue.add(() => place.update(true));
    }

    // TODO: metadata gets (re)loaded too often and isn't batched.
    // Should probably be batched before loading places.
    private async loadPlace(metadata: PlaceTokenMetadata) {
        // early out if it's already loaded.
        // NOTE: done't need to early out. Souldn't happen.
        // Check anyway and log. For now.
        if(this.place) {
            Logging.InfoDev("Place already loaded", metadata.tokenId);
            return;
        }

        try {
            // Create place.
            const new_place = new InteriorPlaceNode(metadata.tokenId, metadata, this);
            this.place = new_place;

            // Load items.
            await new_place.load();
        }
        catch(e) {
            Logging.InfoDev("Error loading place: " + metadata.tokenId);
            Logging.InfoDev(e);
            Logging.InfoDev(metadata);
        }
    }

    private lastMultiplayerUpdate: number = 0;

    private updateMultiplayer() {
        if(this.multiClient && this.multiClient.connected) {
            // Occasionally send player postition.
            const now = performance.now();
            const elapsed = now - this.lastMultiplayerUpdate;
            if(!this.game.playerController.flyMode && elapsed > MultiplayerClient.UpdateInterval) {
                this.lastMultiplayerUpdate = now;

                this.multiClient.updatePlayerPosition(
                    this.game.playerController.getPosition(),
                    this.game.playerController.getRotation()
                );
            }

            // interpolate other players
            this.multiClient.interpolateOtherPlayers();
        }
    }

    private updateCurrentPlace() {
        this.game.playerController.currentPlace = this.place;
    }

    private lastShadowListTime: number = 0;
    private shadowRenderList: AbstractMesh[] = [];

    private updateShadowRenderList = () => {
        // Update shadow list if enough time has passed.
        if(performance.now() - this.lastShadowListTime > shadowListUpdateInterval)
        {
            const playerPos = this.game.playerController.getPosition();
            // clear list
            this.shadowRenderList.length = 0;
            // add items in places nearby.
            if (this.place) {
                if (Vector3.Distance(this.place.origin, playerPos) < 75) // TODO: don't hardcode this value.
                    this.place.itemsNode?.getChildMeshes().forEach(m => {
                        this.shadowRenderList.push(m);
                    });
            }

            this.lastShadowListTime = performance.now();
        }
    }

    // TODO: go over this again.
    private updateWorld = () => {
        const playerPos = this.game.playerController.getPosition();

        // Set slow artifact loading if there was user input recently.
        ArtifactProcessingQueue.isSlow = Date.now() - this.game.playerController.lastUserInputTime < 1000;

        this.sunLight.update(playerPos);
        this.skybox.position.set(playerPos.x, 0, playerPos.z)

        // update multiplayer
        this.updateMultiplayer();

        // Update world when player has moved a certain distance.
        if(!this.worldUpdatePending && Vector3.Distance(this.lastUpdatePosition, playerPos) > worldUpdateDistance)
        {
            this.worldUpdatePending = true;
            this.lastUpdatePosition = playerPos.clone();
            
            // TEMP: do this asynchronously, getting lots of metadata
            // from storage is kinda slow.
            // TODO: Maybe have a position cache?
            (async () => {
                try {
                    // Update LOD
                    if (this.place) {
                        this.place.updateLOD();
                    }
                }
                // TODO: handle error
                finally {
                    this.worldUpdatePending = false;
                }
            })();
        }

        // If items have been loaded, clean up some caches.
        if (ArtifactMemCache.itemsLoaded) {
            ArtifactMemCache.itemsLoaded = false;
            this.game.scene.cleanCachedTextureBuffer();
        }
    }
}