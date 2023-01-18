import { Vector3, Color3, Matrix, Vector4,
    Quaternion, HemisphericLight, ShadowGenerator,
    Mesh, DeepImmutable, MeshBuilder, Nullable, Ray,
    ReflectionProbe, RenderTargetTexture,
    SceneLoader, TransformNode } from "@babylonjs/core";
import { SkyMaterial } from "@babylonjs/materials";
import Metadata, { PlaceTokenMetadata } from "./Metadata";
import AppSettings from "../storage/AppSettings";
import Contracts, { ALL_WORLD_EP_NAMES } from "../tz/Contracts";
import { Logging } from "../utils/Logging";
import { OperationContent, Subscription } from "@taquito/taquito";
import { OperationContentsAndResultTransaction } from '@taquito/rpc'
import { ParameterSchema } from '@taquito/michelson-encoder'
import SunLight from "./nodes/SunLight";
import { MeshUtils } from "../utils/MeshUtils";
import assert from "assert";
import { Edge } from "../worldgen/WorldPolygon";
import WorldGrid from "../utils/WorldGrid";
import ArtifactMemCache, { instantiateOptions } from "../utils/ArtifactMemCache";
import TeleporterBooth from "./nodes/TeleporterBooth";
import { BaseWorld } from "./BaseWorld";
import ArtifactProcessingQueue from "../utils/ArtifactProcessingQueue";
import { Game } from "./Game";
import PlaceNode from "./nodes/PlaceNode";
import Conf from "../Config";
import PlaceKey from "../utils/PlaceKey";
import { ImportedWorldDef } from "./ImportWorldDef";
import Water from "./nodes/Water";
import EventBus, { ChangeCurrentPlaceEvent } from "../utils/eventbus/EventBus";


const worldUpdateDistance = 10; // in m
const shadowListUpdateInterval = 2000; // in ms


export class World extends BaseWorld {
    private worldNode: TransformNode;

    private waterNode: Water;
    
    private sunLight: SunLight;
    private skybox: Mesh;
    
    private shadowGenerator: Nullable<ShadowGenerator>;
    private reflectionProbe: ReflectionProbe;

    readonly places: Map<number, PlaceNode>; // The currently loaded places.

    private implicitWorldGrid: WorldGrid;
    private worldPlaceCount: number = 0;

    private lastUpdatePosition: Vector3;
    private worldUpdatePending: boolean = false;

    private subscription?: Subscription<OperationContent> | undefined;

    constructor(game: Game) {
        super(game);

        this.places = new Map<number, PlaceNode>();
        this.implicitWorldGrid = new WorldGrid();

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

        // The worlds water.
        const waterNode = new Water("water", this);
        waterNode.parent = this.worldNode;
        waterNode.material.addToRenderList(this.skybox);
        this.waterNode = waterNode;

        // After, camera, lights, etc, the shadow generator
        this.shadowGenerator = this.createShadowGenerator(this.sunLight.light);

        // Load districts, ie: ground meshes, bridges, etc.
        this.loadDistricts();

        this.game.scene.registerBeforeRender(this.updateShadowRenderList);
        this.game.scene.registerAfterRender(this.updateWorld);

        this.registerPlacesSubscription();

        // Delay start MultiplayerClient.
        this.game.multiClient.changeRoom("hub");

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

                    // Reload place if it belongs to our current world
                    if (params.place_key.fa2 === Conf.place_contract)
                        this.reloadPlace(new PlaceKey(params.place_key.id.toNumber(), params.place_key.fa2));
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
        this.game.scene.unregisterAfterRender(this.updateWorld);

        this.game.scene.environmentTexture = null;
        this.reflectionProbe.dispose();

        this.shadowGenerator?.dispose();
        this.shadowGenerator = null;
        
        this.unregisterPlacesSubscription();

        // Dispose all places.
        for (const p of this.places.values()) {
            p.dispose();
        }
        this.places.clear();

        // Dispose world.
        this.worldNode.dispose();
    }

    // TODO: add a list of pending places to load.
    protected override async _loadWorld() {
        // TODO: assert that the world can only be loaded once!
        this.worldUpdatePending = true;

        // fetch the most recent world place count
        this.worldPlaceCount = (await Contracts.countExteriorPlacesView(this.game.walletProvider)).toNumber();
        Logging.InfoDev("world has " + this.worldPlaceCount + " places.");

        const playerPos = this.game.playerController.getPosition();
        // Make sure updateWorld() doesn't immediately run again
        this.lastUpdatePosition = playerPos.clone();

        // Get grid cells close to player position.
        const gridCells = await this.implicitWorldGrid.getPlacesForPosition(playerPos.x, 0, playerPos.z, this.worldPlaceCount, AppSettings.drawDistance.value);

        // Get list of place ids from cells.
        // TODO: maybe do this in getPlacesForPosition.
        const placeIds: number[] = []
        gridCells.forEach((c) => {
            c.places.forEach((id) => {
                placeIds.push(id);
            });
        });

        // Batch load all (un)loaded places metadata and return
        const place_metadatas = await Metadata.getPlaceMetadataBatch(placeIds, Conf.place_contract);

        // TODO: Get rid of places out of reach?
        /*// Figure out by distance to player if the place should be loaded load.
        if(Vector3.Distance(player_pos, origin) < this.placeDrawDistance)
            nearby_places.push(placeMetadata)*/

        // Sort by distance to player.
        place_metadatas.sort((a, b) => {
            const origin_a = Vector3.FromArray(a.centerCoordinates);
            const origin_b = Vector3.FromArray(b.centerCoordinates);
            return Vector3.Distance(playerPos, origin_a) - Vector3.Distance(playerPos, origin_b);
        });

        const placeLoadPromises: Promise<void>[] = [];

        // Finally, load places.
        place_metadatas.forEach((metadata) => {
            placeLoadPromises.push(this.loadPlace(new PlaceKey(metadata.tokenId, metadata.contract), metadata));
        })

        await Promise.allSettled(placeLoadPromises);

        // TEMP: workaround as long as loading owner and owned is delayed.
        const currentPlace = this.game.playerController.currentPlace;
        if(currentPlace)
            EventBus.publish("change-current-place", new ChangeCurrentPlaceEvent(currentPlace));

        this.worldUpdatePending = false;
    };

    private loadDistricts() {
        let counter = 0;
        for (const district of ImportedWorldDef.districts) {
            const center = new Vector3(district.center.x, 0, district.center.y);
            let vertices: Vector3[] = [];

            district.vertices.forEach((vertex) => {
                vertices.push(new Vector3(vertex.x, 0, vertex.y));
            });
            vertices = vertices.reverse()

            // Create "island".
            const mesh = MeshUtils.extrudeMeshFromShape(vertices, 50, center, this.game.defaultMaterial,
                `district${counter}`, this.game.scene, Mesh.DEFAULTSIDE, true);
            mesh.checkCollisions = true;
            mesh.receiveShadows = true;
            mesh.position.y = -0.01;
            mesh.parent = this.worldNode;
            mesh.freezeWorldMatrix();

            this.waterNode.material.addToRenderList(mesh);

            // TODO: gaps for bridges.
            // Create invisible wall.
            /*const walls = MeshUtils.extrudeShape([new Vector3(), new Vector3(0,2,0)], vertices, center, this.defaultMaterial,
                `district${counter}`, this.scene, Mesh.BACKSIDE);
            walls.checkCollisions = true;
            walls.receiveShadows = false;
            walls.visibility = 0;*/

            //this.loadRoadDecorations(district.curbs, counter);
            this.loadTeleportationBooths(district);

            counter++;
        }

        counter = 0;
        for (const bridge of ImportedWorldDef.bridges) {
            let points: Vector3[] = [];

            bridge.bridge_path.forEach((vertex) => {
                points.push(new Vector3(vertex.x, 0, vertex.y));
            });

            const bridgeNode = new TransformNode(`bridge${counter}`, this.game.scene);
            bridgeNode.parent = this.worldNode;

            // For now, bridge paths can only be a line
            const bridge_width = 8;
            const bridge_vector = points[1].subtract(points[0]);
            const bridge_length = bridge_vector.length() + 2;
            //const half_bridge_length = bridge_length * 0.5;
            const bridge_pos = points[0].add(points[1]).multiplyByFloats(0.5, 0.5, 0.5);
            const rot_m = new Matrix();
            rot_m.setRow(2, Vector4.FromVector3(bridge_vector.normalize(), 1));
            rot_m.setRow(1, Vector4.FromVector3(Vector3.Up(), 1));
            rot_m.setRow(0, Vector4.FromVector3(Vector3.Cross(Vector3.Up(), bridge_vector.normalize()), 1));

            const walkway0 = MeshBuilder.CreateBox("walkway0", {
                width: bridge_width,
                depth: bridge_length,
                height: 1,
            }, this.game.scene);
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
            }, this.game.scene);
            left.checkCollisions = true;
            left.isPickable = true;
            left.parent = bridgeNode;
            left.position.set(-bridge_width/2 - 0.5, 0.5, 0);
            this.shadowGenerator?.addShadowCaster(left);

            const right = MeshBuilder.CreateBox("wall1", {
                width: 1,
                depth: bridge_length,
                height: 2,
            }, this.game.scene);
            right.checkCollisions = true;
            right.isPickable = true;
            right.parent = bridgeNode;
            right.position.set(bridge_width/2 + 0.5, 0.5, 0);
            this.shadowGenerator?.addShadowCaster(right);

            bridgeNode.position = bridge_pos;
            bridgeNode.position.y = -0.525;

            bridgeNode.rotation = Quaternion.FromRotationMatrix(rot_m).toEulerAngles();

            bridgeNode.getChildMeshes().forEach(m => m.freezeWorldMatrix());

            counter++;
        }
    }

    //private teleportation booths
    private async loadTeleportationBooths(district: any) {
        for (const p of district.teleportation_booths) {
            const booth = new TeleporterBooth(new Vector3(p.x + district.center.x, 0, p.y + district.center.y), this.game.scene);
            booth.parent = this.worldNode;
        }
    }

    //private roadDecorations: Nullable<TransformNode> = null;

    // TODO: Needs to be culled!
    public async loadRoadDecorations(curbs: Edge[], counter: number) {
        const roadDecorations = new TransformNode(`roadDecorations${counter}`, this.game.scene);
        roadDecorations.parent = this.worldNode;

        // TODO: don't load this multiple times. Use ArtifactMemCache.loadOther.
        const result = await SceneLoader.LoadAssetContainerAsync('/models/', 'lantern.glb', this.game.scene, null, '.glb');
        result.meshes.forEach((m) => { m.checkCollisions = true; })
        
        for (var curbEdge of curbs) {
            const from = new Vector3(curbEdge.a.x, 0, curbEdge.a.y);
            const to = new Vector3(curbEdge.b.x, 0, curbEdge.b.y);

            const line = from.subtract(to);
            const line_len = line.length();
            if(line_len > 13) {
                //const lineMesh = Mesh.CreateLines("line", [from, to], this.scene, false);
                
                for (var d = 6.5; d < line_len - 6.5; d = d + 25) {
                    // NOTE: using doNotInstantiate predicate to force skinned meshes to instantiate. https://github.com/BabylonJS/Babylon.js/pull/12764
                    const instance = result.instantiateModelsToScene(undefined, false, instantiateOptions()).rootNodes[0];
                    instance.position = to.add(line.scale(d / line_len));
                    instance.parent = roadDecorations;
                    this.shadowGenerator?.addShadowCaster(instance as Mesh);
                }
            }
        }
    }

    private async reloadPlace(placeKey: PlaceKey) {
        // TODO: assert the place belong to this world.
        // Queue a place update.
        const place = this.places.get(placeKey.id);
        if (place) this.game.onchainQueue.add(() => place.update(true));
    }

    // TODO: metadata gets (re)loaded too often and isn't batched.
    // Should probably be batched before loading places.
    private async loadPlace(placeKey: PlaceKey, metadata: PlaceTokenMetadata) {
        // early out if it's already loaded.
        // NOTE: done't need to early out. Souldn't happen.
        // Check anyway and log. For now.
        if(this.places.has(metadata.tokenId)) {
            Logging.InfoDev("Place already existed", metadata.tokenId);
            return;
        }

        try {
            const origin = Vector3.FromArray(metadata.centerCoordinates);

            // Figure out by distance to player if the place should load.
            const player_pos = this.game.playerController.getPosition();
            if(Vector3.Distance(player_pos, origin) < AppSettings.drawDistance.value) {
                // Create place.
                const new_place = new PlaceNode(placeKey, metadata, this);
                this.places.set(metadata.tokenId, new_place);

                // Load items.
                await new_place.load();
            }
        }
        catch(e) {
            Logging.InfoDev("Error loading place: " + metadata.tokenId);
            Logging.InfoDev(e);
            Logging.InfoDev(metadata);
        }
    }

    private updateCurrentPlace(pos: DeepImmutable<Vector3>) {
        const pickResult = this.game.scene.pickWithRay(new Ray(pos, Vector3.Up()), (mesh) => {
            return mesh.parent instanceof PlaceNode;
        });

        if (pickResult && pickResult.hit && pickResult.pickedMesh) {
            assert(pickResult.pickedMesh.parent instanceof PlaceNode);

            // TODO: use normal to determine whether we are inside our out.
            if (Vector3.Dot(pickResult.getNormal()!, pickResult.ray!.direction) < 0)
                this.game.playerController.currentPlace = pickResult.pickedMesh.parent;
        }
    }

    protected override updateShadowRenderList = () => {
        // Update shadow list if enough time has passed.
        if(performance.now() - this.lastShadowListTime > shadowListUpdateInterval)
        {
            const playerPos = this.game.playerController.getPosition();
            // TODO: don't clear list? overwrite elements and then trim remaining?
            // not sure that's faster... maybe use a smart array instead.
            // clear list
            this.shadowRenderList.length = 0;
            // add items in places nearby.
            this.places.forEach(place => {
                if (Vector3.Distance(place.origin, playerPos) < 75) // TODO: don't hardcode this value.
                    place.itemsNode?.getChildMeshes().forEach(m => {
                        // NOTE: objects recieving shadows can't cast shadows for now.
                        if (!m.receiveShadows) this.shadowRenderList.push(m);
                    })
            });

            this.lastShadowListTime = performance.now();
        }
    }

    // TODO: go over this again.
    private updateWorld = () => {
        const playerPos = this.game.playerController.getPosition();

        // Set slow artifact loading if there was user input recently.
        ArtifactProcessingQueue.isSlow = Date.now() - this.game.playerController.lastUserInputTime < 1000;

        // Update current place.
        // TODO: only occasionally check. maybe based on distance or time.
        this.updateCurrentPlace(playerPos);

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
                    //const start_time = performance.now();

                    const gridCell = await this.implicitWorldGrid.getPlacesForPosition(playerPos.x, 0, playerPos.z, this.worldPlaceCount, AppSettings.drawDistance.value);

                    // Check all loaded places for distance and remove or update LOD
                    this.places.forEach((v, k) => {
                        // Multiply draw distance with small factor here to avoid imprecision and all that
                        if(Vector3.Distance(playerPos, v.origin) > AppSettings.drawDistance.value * 1.02) {
                            this.places.delete(k);
                            v.dispose();
                        }
                        else v.updateLOD();
                    });

                    const places_to_fetch: number[] = []

                    gridCell.forEach((c) => {
                        c.places.forEach((id) => {
                            if (!this.places.has(id)) places_to_fetch.push(id);
                        });
                    });

                    (await Metadata.getPlaceMetadataBatch(places_to_fetch, Conf.place_contract)).forEach((m) => {
                        this.loadPlace(new PlaceKey(m.tokenId, m.contract), m);
                    });

                    //const elapsed_total = performance.now() - start_time;
                    //Logging.InfoDev("updateWorld took " + elapsed_total.toFixed(2) + "ms");
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