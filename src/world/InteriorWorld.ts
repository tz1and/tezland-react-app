import { Vector3, Color3, HemisphericLight,
    ShadowGenerator, CascadedShadowGenerator, Mesh,
    AbstractMesh, Nullable, ReflectionProbe,
    RenderTargetTexture, TransformNode, Color4 } from "@babylonjs/core";
import { SkyMaterial } from "@babylonjs/materials";
import InteriorPlaceNode from "./nodes/InteriorPlaceNode";
import Metadata, { PlaceTokenMetadata } from "./Metadata";
import AppSettings from "../storage/AppSettings";
import Contracts, { ALL_WORLD_EP_NAMES } from "../tz/Contracts";
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
import PlaceKey from "../utils/PlaceKey";
import PlaceProperties from "../utils/PlaceProperties";
import WorldLocation from "../utils/WorldLocation";


const worldUpdateDistance = 10; // in m
const shadowListUpdateInterval = 2000; // in ms

const defaultLightDir = new Vector3(50, 100, -50).normalize();


export class InteriorWorld extends BaseWorld {
    private worldNode: TransformNode;

    private sunLight: SunLight;
    private skybox: Mesh;
    
    private shadowGenerator: Nullable<ShadowGenerator>;
    private reflectionProbe: ReflectionProbe;

    private lastUpdatePosition: Vector3;
    private worldUpdatePending: boolean = false;

    private multiClient?: MultiplayerClient | undefined;

    private subscription?: Subscription<OperationContent> | undefined;

    private place: Nullable<InteriorPlaceNode> = null;

    private ground: Mesh;

    constructor(game: Game) {
        super(game);

        this.lastUpdatePosition = this.game.playerController.getPosition().clone();

        this.worldNode = new TransformNode("worldNode", this.game.scene);
        
        // Create sun and skybox
        const sun_direction = defaultLightDir.negate();
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

        this.skybox = Mesh.CreateBox('skyBox', 1000, this.game.scene, false, Mesh.BACKSIDE);
        this.skybox.material = skyMaterial;
        this.skybox.parent = this.worldNode;

        // Since we are always inside a skybox, we can turn off autoClear
        this.game.scene.autoClear = false; // Color buffer

        // reflection probe
        this.reflectionProbe = new ReflectionProbe('reflectionProbe', 256, this.game.scene);
        assert(this.reflectionProbe.renderList);
        this.reflectionProbe.renderList.push(this.skybox);
        this.reflectionProbe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
        this.game.scene.environmentTexture = this.reflectionProbe.cubeTexture;

        this.ground = Mesh.CreateGround("interiorGround", 2000, 2000, 4, this.game.scene);
        this.ground.material = this.game.defaultMaterial;
        this.ground.isPickable = true;
        this.ground.checkCollisions = true;
        this.ground.receiveShadows = true;
        this.ground.position.y = -0.01;
        this.ground.parent = this.worldNode;

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

        // NOTE: add a dummy shadow caster, otherwise shadows won't work.
        if (this.shadowGenerator) {
            const shadowDummy = Mesh.CreateBox("dummyShadowCaster", 1.0, this.game.scene);
            shadowDummy.isVisible = false;
            shadowDummy.position.y = -10;
            shadowDummy.parent = this.worldNode;
            this.shadowGenerator.addShadowCaster(shadowDummy);
        }

        if(this.shadowGenerator) {
            let rtt = this.shadowGenerator.getShadowMap();

            if(rtt) {
                Logging.InfoDev("Setting up custom render list for shadow generator")
                rtt.getCustomRenderList = (layer, renderList, renderListLength) => {
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
        this.subscription = await Contracts.subscribeToPlaceChanges(this.game.walletProvider);
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
            if (ALL_WORLD_EP_NAMES.includes(ep)) {
                try {
                    const schema = new ParameterSchema(Contracts.worldContract!.entrypoints.entrypoints[ep])
                    const params = schema.Execute(tContent.parameters.value);

                    // Reload place if our interior canged.
                    if (this.place
                        && this.place.placeKey.id === params.place_key.id.toNumber()
                        && this.place.placeKey.fa2 === params.place_key.fa2)
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

        this.game.scene.environmentTexture = null;
        this.reflectionProbe.dispose();

        this.shadowGenerator?.dispose();
        this.shadowGenerator = null;
        
        this.unregisterPlacesSubscription();
        this.multiClient?.disconnectAndDispose();

        this.place?.dispose();
        this.place = null;

        this.worldNode.dispose();
    }

    // TODO: add a list of pending places to load.
    public async loadWorld(placeKey: PlaceKey) {
        assert(this.place === null, "Interior was already loaded!");
        this.worldUpdatePending = true;

        // Batch load all (un)loaded places metadata and return
        const place_metadata = await Metadata.getPlaceMetadata(placeKey.id, placeKey.fa2);
        assert(place_metadata);

        await this.loadPlace(placeKey, place_metadata);

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
    private async loadPlace(placeKey: PlaceKey, metadata: PlaceTokenMetadata) {
        // early out if it's already loaded.
        // NOTE: done't need to early out. Souldn't happen.
        // Check anyway and log. For now.
        if(this.place) {
            Logging.InfoDev("Place already loaded", metadata.tokenId);
            return;
        }

        try {
            // Create place.
            const new_place = new InteriorPlaceNode(placeKey, metadata, this);
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
                        // NOTE: objects recieving shadows can't cast shadows for now.
                        if (!m.receiveShadows) this.shadowRenderList.push(m);
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

    public updateOnPlacePropChange(props: PlaceProperties, first_load: boolean) {
        assert(this.place);
        assert(this.place.itemsNode);
        if (first_load && props.spawnPosition) {
            this.game.playerController.teleportToLocal(new WorldLocation({pos: props.spawnPosition.add(this.place.itemsNode.position)}));
            this.game.playerController.freeze = true;
        }

        // Update world floor
        this.ground.setEnabled(!(props.interiorDisableFloor || false));

        // Update light direction.
        const lightDir = props.interiorLightDirection ? props.interiorLightDirection : defaultLightDir;
        const normalised_light_dir = lightDir.normalizeToNew().negateInPlace();
        this.sunLight.light.direction = normalised_light_dir;
        
        if (props.interiorBackgroundColor) {
            this.game.scene.clearColor = Color4.FromHexString(props.interiorBackgroundColor);
            this.skybox.setEnabled(false);
            this.game.scene.autoClear = true;
        }
        else {
            /*const normalised_light_dir = lightDir.normalizeToNew().negateInPlace();
            this.sunLight.light.direction = normalised_light_dir;*/
            const skyMaterial = this.skybox.material as SkyMaterial;
            skyMaterial.sunPosition = normalised_light_dir.negate();
            this.skybox.setEnabled(true);
            this.game.scene.autoClear = false;
        }
    }
}