import { ReflectionProbe } from "@babylonjs/core/Probes";
import { HemisphericLight, ShadowGenerator } from "@babylonjs/core/Lights";
import { Mesh, MeshBuilder, TransformNode } from "@babylonjs/core/Meshes";
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths";
import { Nullable } from "@babylonjs/core/types";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures";
import { SkyMaterial } from "@babylonjs/materials";
import InteriorPlaceNode from "./nodes/InteriorPlaceNode";
import Metadata, { PlaceTokenMetadata } from "./Metadata";
import Contracts, { ALL_WORLD_EP_NAMES } from "../tz/Contracts";
import { Logging } from "../utils/Logging";
import { OperationContent, Subscription } from "@taquito/taquito";
import { OperationContentsAndResultTransaction } from '@taquito/rpc'
import { ParameterSchema } from '@taquito/michelson-encoder'
import SunLight from "./nodes/SunLight";
import ArtifactMemCache from "../utils/ArtifactMemCache";
import { BaseWorld } from "./BaseWorld";
import ArtifactProcessingQueue from "../utils/ArtifactProcessingQueue";
import { Game } from "./Game";
import PlaceKey from "../utils/PlaceKey";
import PlaceProperties from "../utils/PlaceProperties";
import WorldLocation from "../utils/WorldLocation";
import Water from "./nodes/Water";
import { assert } from "../utils/Assert";
//import bg_tex from '../img/bg_texture.png';


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

    private subscription?: Subscription<OperationContent> | undefined;

    private place: Nullable<InteriorPlaceNode> = null;
    private placeKey: Nullable<PlaceKey> = null;

    private ground: Mesh;

    private waterNode: Nullable<Water>;

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
        //skyMaterial.fogEnabled = false;
        skyMaterial.useSunPosition = true;
        skyMaterial.sunPosition = sun_direction.scale(-1);
        skyMaterial.dithering = true;

        this.skybox = MeshBuilder.CreateIcoSphere("skyBox", {subdivisions: 8, radius: 1000.0, sideOrientation: Mesh.BACKSIDE}, this.game.scene);
        //this.skybox.infiniteDistance = true; // What does this do?
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

        this.ground = MeshBuilder.CreateGround("interiorGround", {width: 2000.0, height: 2000.0, subdivisions: 4}, this.game.scene);
        this.ground.material = this.game.defaultMaterial;
        this.ground.isPickable = true;
        this.ground.checkCollisions = true;
        this.ground.receiveShadows = true;
        this.ground.position.y = -0.01;
        this.ground.parent = this.worldNode;

        this.waterNode = null;

        // After, camera, lights, etc, the shadow generator
        this.shadowGenerator = this.createShadowGenerator(this.sunLight.light);

        // NOTE: add a dummy shadow caster, otherwise shadows won't work.
        if (this.shadowGenerator) {
            const shadowDummy = MeshBuilder.CreateBox("dummyShadowCaster", {size: 1.0}, this.game.scene);
            shadowDummy.isVisible = false;
            shadowDummy.position.y = -10;
            shadowDummy.parent = this.worldNode;
            this.shadowGenerator.addShadowCaster(shadowDummy);

            this.game.scene.registerBeforeRender(this.updateShadowRenderList);
        }

        this.game.scene.registerBeforeRender(this.updateWorld);

        this.registerPlacesSubscription();

        //new UniversalCamera("testCam", new Vector3(0,2,-10), this.scene);
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

    public override getWorldNode() {
        return this.worldNode;
    }

    public dispose() {
        this.game.scene.unregisterBeforeRender(this.updateShadowRenderList);
        this.game.scene.unregisterBeforeRender(this.updateWorld);

        this.game.scene.environmentTexture = null;
        this.reflectionProbe.dispose();

        this.shadowGenerator?.dispose();
        this.shadowGenerator = null;
        
        this.unregisterPlacesSubscription();

        this.place?.dispose();
        this.place = null;

        this.worldNode.dispose();
    }

    public setPlaceKey(placeKey: PlaceKey) {
        this.placeKey = placeKey;
    }

    // TODO: add a list of pending places to load.
    protected override async _loadWorld() {
        //Logging.InfoDev("InteriorWorld::loadWorld");
        assert(this.placeKey !== null, "PlaceKey not set on Interior");
        assert(this.place === null, "Interior was already loaded");
        this.worldUpdatePending = true;

        // Batch load all (un)loaded places metadata and return
        const place_metadata = await Metadata.getPlaceMetadata(this.placeKey.id, this.placeKey.fa2);
        assert(place_metadata);

        await this.loadPlace(this.placeKey, place_metadata);

        // We only need to set the place once for interiors.
        this.updateCurrentPlace();

        this.worldUpdatePending = false;

        await this.game.multiClient.changeRoom("interior", {placeId: this.placeKey.id});
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

    private updateCurrentPlace() {
        this.game.playerController.currentPlace = this.place;
    }

    protected override updateShadowRenderList = () => {
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
        this.skybox.position.copyFrom(playerPos);

        // update multiplayer
        this.game.multiClient.updateMultiplayer();

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

        /*(async () => {
            //this.skybox.dispose();

            /*const req = await fetch(bg_tex);
            const res = await createImageBitmap(await req.blob()); // {resizeWidth: width, resizeHeight: height, resizeQuality: "medium"}

            // Compute new height < maxTexRes
            let newWidth = 1024;
            let newHeight = 1024;

            Logging.InfoDev("old", res.width, res.height);
            Logging.InfoDev("new", newWidth, newHeight);

            const canvas: any = new OffscreenCanvas(newWidth, newHeight);
            const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
            assert(context);
            context.drawImage(res, 0, 0, newWidth, newHeight);
            const data = context.getImageData(0, 0, newWidth, newHeight);
            //Logging.InfoDev(data);
            // @ts-expect-error
            const buffer = data.buffer;

            const cube_tex = new RawCubeTexture(this.game.scene, [buffer, buffer, buffer, buffer, buffer, buffer], 1024); //, Engine.TEXTUREFORMAT_RGBA_INTEGER); //, Engine.TEXTURETYPE_UNSIGNED_BYTE);* /

            //const cube_tex = CubeTexture.CreateFromImages([bg_tex, bg_tex, bg_tex, bg_tex, bg_tex, bg_tex], this.game.scene);

            const skyboxMaterial = new StandardMaterial("skyBoxMat", this.game.scene);
            skyboxMaterial.backFaceCulling = true;
            skyboxMaterial.reflectionTexture = cube_tex;
            skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
            skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
            skyboxMaterial.specularColor = new Color3(0, 0, 0);
            this.skybox.material = skyboxMaterial;
        })()*/

        // Update env probe.
        this.reflectionProbe.cubeTexture.resetRefreshCounter();

        // The worlds water.
        if (props.interiorWaterLevel) {
            if (this.waterNode) this.waterNode.waterLevel = props.interiorWaterLevel;
            else {
                const waterNode = new Water("water", this);
                waterNode.parent = this.worldNode;
                waterNode.material.addToRenderList(this.skybox);
                waterNode.waterLevel = props.interiorWaterLevel;
                this.waterNode = waterNode;
            }
        }
        else {
            if (this.waterNode) {
                this.waterNode.dispose();
                this.waterNode = null;
            }
        }
    }
}