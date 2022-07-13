import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Matrix, Vector4, Quaternion, } from "@babylonjs/core/Maths/math";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { SimpleMaterial, SkyMaterial } from "@babylonjs/materials";
import { EventState, FreeCamera, MeshBuilder, TransformNode } from "@babylonjs/core";
import { MapControlFunctions } from "./AppControlFunctions";
import { ITezosWalletProvider } from "../components/TezosWalletContext";
import Metadata from "./Metadata";
import AppSettings from "../storage/AppSettings";
import { Logging } from "../utils/Logging";
import SunLight from "./SunLight";
import { MeshUtils } from "../utils/MeshUtils";
import { isDev } from "../utils/Utils";
import WorldGrid from "../utils/WorldGrid";
import MapPlaceNode from "./nodes/MapPlaceNode";
import { OrthoCameraMouseInput } from "./input/OrthoCameraMouseInput";
import { AdvancedDynamicTexture, Control, Image, Vector2WithInfo } from "@babylonjs/gui";
import { WorldInterface } from "./WorldInterface";
import { grapphQLUser } from "../graphql/user";
import assert from "assert";

import markerIconBlue from '../img/map/mapmarker-blue.png'
import markerIconCyan from '../img/map/mapmarker-cyan.png'
import markerIconOrange from '../img/map/mapmarker-orange.png'
import markerIconPink from '../img/map/mapmarker-pink.png'
import markerIconPurple from '../img/map/mapmarker-purple.png'
import markerIconRed from '../img/map/mapmarker-red.png'

import { WorldDefinition } from "../worldgen/WorldGen";
import world_definition from "../models/districts.json";
Object.setPrototypeOf(world_definition, WorldDefinition.prototype);


export enum MarkerMode {
    SpawnsAndTeleporters = 0,
    Places = 1 // Can also be used to not mark anything
}

type MarkerColor = "blue" | "cyan" | "orange" | "pink" | "purple" | "red";
type MarkerType = "place" | "district" | "teleporter";

const markerIconsByColor: Map<MarkerColor, string> = new Map([
    ["blue", markerIconBlue],
    ["cyan", markerIconCyan],
    ["orange", markerIconOrange],
    ["pink", markerIconPink],
    ["purple", markerIconPurple],
    ["red", markerIconRed]
]);

type MapMarkerInfo = {
    description: string;
    mapPosition: [number, number];
    location: string; // either district#, place# or teleporter#
    id: number;
}

export type MapPopoverInfo = {
    screenPos: [number, number];
    metadata: MapMarkerInfo
}

export class WorldMap implements WorldInterface {
    // From WorldInterface
    readonly walletProvider: ITezosWalletProvider;
    readonly engine: Engine;
    readonly scene: Scene;

    readonly mapControlFunctions: MapControlFunctions;
    
    private defaultMaterial: SimpleMaterial;
    //private waterMaterial: WaterMaterial;
    readonly transparentGridMat: SimpleMaterial;
    readonly transparentGridMatPublic: SimpleMaterial;
    private sunLight: SunLight;

    readonly places: Map<number, MapPlaceNode>; // The currently loaded places.

    private implicitWorldGrid: WorldGrid;
    private worldPlaceCount: number = 0;

    private orthoCam: FreeCamera;

    private lastWorldUpdateTime: number;
    private worldUpdatePending: boolean = false;

    private needsRedraw: boolean = false;
    private viewUpdated: boolean = false;
    private lastRenderTime: number = 0;

    private markedPlaces: Set<number> = new Set();

    private markerMode: MarkerMode;

    private markerOverlayTexture: AdvancedDynamicTexture;

    constructor(engine: Engine, zoom: number, threeD: boolean, markerMode: MarkerMode, mapControlFunctions: MapControlFunctions, walletProvider: ITezosWalletProvider, placeId?: number, location?: [number, number]) {
        this.mapControlFunctions = mapControlFunctions;
        this.engine = engine;

        this.walletProvider = walletProvider;

        this.markerMode = markerMode;

        this.places = new Map<number, MapPlaceNode>();
        this.implicitWorldGrid = new WorldGrid();

        // Set max texture res
        const caps = this.engine.getCaps();
        caps.maxTextureSize = Math.min(caps.maxTextureSize, AppSettings.textureRes.value);

        // Create our first scene.
        this.scene = new Scene(this.engine, {
            useGeometryUniqueIdsMap: true,
            useMaterialMeshMap: true,
            useClonedMeshMap: true
        });
        //this.scene.collisionsEnabled = true;

        const initCamera = (): FreeCamera => {
            const mapLoaction = location ? new Vector3(location[0], 0, location[1]) : Vector3.Zero();

            // This creates and positions a free camera (non-mesh)
            var camera = new FreeCamera("orthoCamera", mapLoaction.add(threeD ? new Vector3(0, 1000, 400) : new Vector3(0, 1000, 0)), this.scene);

            camera.setTarget(mapLoaction);
    
            // Camera props
            //camera.rotation.set(Angle.FromDegrees(70).radians(), Angle.FromDegrees(200).radians(), 0);
            camera.mode = FreeCamera.ORTHOGRAPHIC_CAMERA;
            camera.minZ = 0.1;
            camera.maxZ = 2000;

            camera.orthoLeft = -(zoom * 0.5);
            camera.orthoRight = (zoom * 0.5);

            const canvas = this.engine.getRenderingCanvas();
            assert(canvas, "Engine not attached to a canvas element");

            const ratio = canvas.height / canvas.width;
            camera.orthoTop = camera.orthoRight * ratio;
            camera.orthoBottom = camera.orthoLeft * ratio;
    
            // Collision stuff
            //camera.checkCollisions = true;
            //camera.applyGravity = true;
            //camera.ellipsoid = new Vector3(0.5, PlayerController.BODY_HEIGHT * 0.5, 0.5);
    
            // Sensibility
            //camera.angularSensibility *= 10 / AppSettings.mouseSensitivity.value;
            // TODO: inertia also affects default camera movement...
            //camera.inertia *= AppSettings.mouseInertia.value;

            const orthoInput = new OrthoCameraMouseInput()
            orthoInput.onPointerMovedObservable.add(() => {
                this.needsRedraw = true;
                this.viewUpdated = true;
                mapControlFunctions.showPopover(undefined);
            });

            camera.inputs.clear();
            camera.inputs.add(orthoInput);
            camera.attachControl(canvas, false);
    
            // Set movement keys
            //camera.inputs.clear();
            //camera.inputs.addMouse();
            ////camera.keysUpward = [32 /*space*/]; // that's not actually jumping.
            ////this.camera.ellipsoidOffset = new Vector3(0, 0, 0);
            ////camera.inertia = 0.5;
            ////camera.angularSensibility = 2;
    
            return camera;
        }

        this.orthoCam = initCamera();
        this.lastWorldUpdateTime = performance.now();

        // Create a dynamic texture for overlay markers
        this.markerOverlayTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");

        // Create a default material
        this.defaultMaterial = new SimpleMaterial("defaulDistrictMat", this.scene);
        this.defaultMaterial.diffuseColor = new Color3(0.3, 0.3, 0.3);

        // transparent grid material for place bounds
        this.transparentGridMat = new SimpleMaterial("transp_grid", this.scene);
        this.transparentGridMat.alpha = 0.8;
        this.transparentGridMat.diffuseColor.set(0.5, 0.5, 0.8);
        //this.transparentGridMat.lineColor.set(0.2, 0.3, 0.8);
        this.transparentGridMat.backFaceCulling = false;

        // transparent grid material for place bounds
        this.transparentGridMatPublic = new SimpleMaterial("transp_grid_public", this.scene);
        this.transparentGridMatPublic.alpha = 0.8;
        this.transparentGridMatPublic.diffuseColor.set(0.4, 0.9, 0.4);
        //this.transparentGridMat.lineColor.set(0.2, 0.3, 0.8);
        this.transparentGridMatPublic.backFaceCulling = false;
        
        // Create sun and skybox
        const sun_direction = new Vector3(-50, -100, 50).normalize();
        this.sunLight = new SunLight("sunLight", sun_direction, this.scene);

        const ambient_light = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), this.scene);
        ambient_light.intensity = 0.25;
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

        this.scene.clearColor.set(0.071, 0.082, 0.133, 1);

        // The worlds water.
        /*const waterMaterial = new WaterMaterial("water", this.scene, new Vector2(512, 512));
        waterMaterial.backFaceCulling = true;
        const bumpTexture = new Texture(waterbump, this.scene);
        bumpTexture.uScale = 4;
        bumpTexture.vScale = 4;
        waterMaterial.bumpTexture = bumpTexture;
        waterMaterial.windForce = -1;
        waterMaterial.waveHeight = 0; //0.05;
        waterMaterial.bumpHeight = 0.15;
        waterMaterial.windDirection = new Vector2(1, 1);
        waterMaterial.waterColor = new Color3(0.01, 0.03, 0.07);
        waterMaterial.colorBlendFactor = 0.7;
        this.waterMaterial = waterMaterial

        const water = Mesh.CreateGround("water", 2000, 2000, 4, this.scene);
        water.material = this.waterMaterial;
        water.isPickable = false;
        water.checkCollisions = true;
        water.receiveShadows = true;
        water.position.y = -3;*/

        window.addEventListener('resize', this.onResize);

        this.scene.registerAfterRender(this.updateWorld.bind(this));

        // Only render if map or camera have been update.
        // Need to figure out a way to listen for changes in the scene
        this.engine.stopRenderLoop();
        this.engine.runRenderLoop(() => {
            if(this.needsRedraw || performance.now() - this.lastRenderTime > 500) {
                this.scene.render();
                this.needsRedraw = false;
                this.lastRenderTime = performance.now();
            }
        });

        this.needsRedraw = true;
    }

    private onResize = () => {
        this.engine.resize();
    }

    public dispose() {
        // Hide inspector in dev
        if(isDev()) this.scene.debugLayer.hide();

        window.removeEventListener('resize', this.onResize);

        this.places.clear();

        // Destorying the engine should prbably be enough.
        this.engine.dispose();
    }

    public addMarkedPlaces(places: number[]) {
        assert(this.markerMode === MarkerMode.Places)
        places.forEach(id => this.markedPlaces.add(id));

        // TODO: Find all places already loaded and mark them
        places.forEach(id => {
            const place = this.places.get(id);
            if (place) {
                this.createMarker(`Place #${id}`,
                    new Vector3(place.metadata.centerCoordinates[0], place.metadata.centerCoordinates[1], place.metadata.centerCoordinates[2]),
                    "purple", "place", id);
            }
        });

        this.needsRedraw = true;
    }

    // TODO: add a list of pending places to load.
    public async loadWorld() {
        this.worldUpdatePending = true;

        // Load districts, ie: ground meshes, bridges, etc.
        this.loadDistricts();

        // fetch the most recent world place count
        this.worldPlaceCount = (await grapphQLUser.countExteriorPlaces()).placeTokenMetadataAggregate.aggregate!.count;
        Logging.InfoDev("world has " + this.worldPlaceCount + " places.");

        const playerPos = this.orthoCam.getTarget();

        // Get grid cells close to player position.
        const gridCells = await this.implicitWorldGrid.getPlacesForPosition(playerPos.x, 0, playerPos.z, this.worldPlaceCount, this.getMaxDrawDistance()); // AppSettings.drawDistance.value);

        // Get list of place ids from cells.
        // TODO: maybe do this in getPlacesForPosition.
        const placeIds: number[] = []
        gridCells.forEach((c) => {
            c.places.forEach((id) => {
                placeIds.push(id);
            });
        });

        // Batch load all (un)loaded places metadata and return
        const place_metadatas = await Metadata.getPlaceMetadataBatch(placeIds);

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

        // Finally, load places.
        place_metadatas.forEach((metadata) => {
            this.loadPlace(metadata);
        });

        this.worldUpdatePending = false;
    };

    private markerClickObserver = (eventData: Vector2WithInfo, eventState: EventState) => {
        //console.log("marker clicked", eventData, eventState, eventState.currentTarget.metadata);
        const target = eventState.currentTarget;
        assert(target);
        this.mapControlFunctions.showPopover({ screenPos: [target.centerX, target.centerY], metadata: target.metadata } as MapPopoverInfo);
    }

    private markerEnterObserver = (control: Control, eventState: EventState) => {
        document.body.style.cursor = "pointer";
    }

    private markerOutObserver = (control: Control, eventState: EventState) => {
        document.body.style.cursor = "default";
    }

    private createMarker(description: string, pos: Vector3, color: MarkerColor, type: MarkerType, id: number): TransformNode {
        const node = new TransformNode("marker", this.scene);
        node.position = pos;
        /*node.billboardMode = Mesh.BILLBOARDMODE_X | Mesh.BILLBOARDMODE_USE_POSITION;

        const plane1 = MeshBuilder.CreatePlane("plane1", { width: 10, height: 15, sideOrientation: Mesh.BACKSIDE });
        plane1.billboardMode = Mesh.BILLBOARDMODE_X | Mesh.BILLBOARDMODE_USE_POSITION;
        plane1.material = this.markerMaterial;
        plane1.parent = node;
        plane1.position.z = -5;
        plane1.renderingGroupId = 2;*/


        /*const box = MeshBuilder.CreateBox("dot", {size: 2.5});
        box.material = this.markerMaterial;
        box.parent = node;

        const box2 = MeshBuilder.CreateBox("line", {width: 2.5, height: 10, depth: 2.5});
        box2.material = this.markerMaterial;
        box2.parent = node;
        box2.position.y = 10;*/

        var markerImage = new Image(undefined, markerIconsByColor.get(color));
        markerImage.widthInPixels = 24;
        markerImage.heightInPixels = 39;
        markerImage.linkOffsetY = -19.5;
        markerImage.zIndex = pos.z;

        markerImage.metadata = {
            description: description,
            mapPosition: [pos.x, pos.z],
            location: type + id,
            id: id
        } as MapMarkerInfo;

        // Mouse interaction stuff.
        markerImage.isPointerBlocker = true;
        markerImage.onPointerClickObservable.add(this.markerClickObserver);
        markerImage.onPointerEnterObservable.add(this.markerEnterObserver);
        markerImage.onPointerOutObservable.add(this.markerOutObserver);

        // Add control and link it to node.
        this.markerOverlayTexture.addControl(markerImage);
        markerImage.linkWithMesh(node);

        return node;
    }

    private loadDistricts() {
        const world_def = world_definition;

        let counter = 0;
        for (const district of world_def.districts) {
            const center = new Vector3(district.center.x, 0, district.center.y);
            let vertices: Vector3[] = [];

            district.vertices.forEach((vertex) => {
                vertices.push(new Vector3(vertex.x, 0, vertex.y));
            });
            vertices = vertices.reverse()

            // Create "island".
            const mesh = MeshUtils.extrudeMeshFromShape(vertices, 10, center, this.defaultMaterial,
                `district${counter}`, this.scene, Mesh.DEFAULTSIDE, true);
            mesh.checkCollisions = true;
            mesh.receiveShadows = true;
            mesh.position.y = -0.01;
            mesh.freezeWorldMatrix();

            mesh.enableEdgesRendering();
            mesh.edgesWidth = 6.0;
            mesh.edgesColor.set(0.6, 0.6, 0.6, 0.8);

            //this.waterMaterial.addToRenderList(mesh);

            // TODO: gaps for bridges.
            // Create invisible wall.
            /*const walls = MeshUtils.extrudeShape([new Vector3(), new Vector3(0,2,0)], vertices, center, this.defaultMaterial,
                `district${counter}`, this.scene, Mesh.BACKSIDE);
            walls.checkCollisions = true;
            walls.receiveShadows = false;
            walls.visibility = 0;*/

            if (this.markerMode === MarkerMode.SpawnsAndTeleporters) {
                this.createMarker(`Spawn District #${counter + 1}`,
                     new Vector3(district.spawn.x + district.center.x, 0, district.spawn.y + district.center.y),
                     "orange", "district", counter + 1);

                this.loadTeleportationBooths(district);
            }

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
            const rot_m = new Matrix();
            rot_m.setRow(2, Vector4.FromVector3(bridge_vector.normalize(), 1));
            rot_m.setRow(1, Vector4.FromVector3(Vector3.Up(), 1));
            rot_m.setRow(0, Vector4.FromVector3(Vector3.Cross(Vector3.Up(), bridge_vector.normalize()), 1));

            const walkway0 = MeshBuilder.CreateBox("walkway0", {
                width: bridge_width,
                depth: bridge_length,
                height: 1,
            }, this.scene);
            walkway0.checkCollisions = true;
            walkway0.isPickable = true;
            walkway0.receiveShadows = true;
            walkway0.parent = bridgeNode;
            
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

            const right = MeshBuilder.CreateBox("wall1", {
                width: 1,
                depth: bridge_length,
                height: 2,
            }, this.scene);
            right.checkCollisions = true;
            right.isPickable = true;
            right.parent = bridgeNode;
            right.position.set(bridge_width/2 + 0.5, 0.5, 0);

            bridgeNode.position = bridge_pos;
            bridgeNode.position.y = -0.525;

            bridgeNode.rotation = Quaternion.FromRotationMatrix(rot_m).toEulerAngles();

            bridgeNode.getChildMeshes().forEach((m) => {
                m.freezeWorldMatrix();
                m.enableEdgesRendering();
                m.edgesWidth = 6.0;
                m.edgesColor.set(0.2, 0.2, 0.2, 0.8);
                //m.material!.alpha = 0;
            });

            counter++;
        }

        this.needsRedraw = true;
    }

    //private teleportation booths
    private async loadTeleportationBooths(district: any) {
        let counter = 0;
        for (const p of district.teleportation_booths) {
            this.createMarker(`A teleportation booth.`,
                new Vector3(p.x + district.center.x, 0, p.y + district.center.y),
                "red", "teleporter", counter);

            counter++;
        }
    }

    // TODO: metadata gets (re)loaded too often and isn't batched.
    // Should probably be batched before loading places.
    private loadPlace(metadata: any) {
        // early out if it's already loaded.
        // NOTE: done't need to early out. Souldn't happen.
        // Check anyway and log. For now.
        if(this.places.has(metadata.id)) {
            Logging.InfoDev("Place already existed", metadata.id);
            return;
        }

        try {
            // Figure out by distance to player if the place should load.
            //const origin = Vector3.FromArray(placeMetadata.centerCoordinates);
            //const player_pos = new Vector3();
            //if(Vector3.Distance(player_pos, origin) < AppSettings.drawDistance.value) {
                // Create place.
                const new_place = new MapPlaceNode(metadata.id, metadata, this);
                this.places.set(metadata.id, new_place);

                // If this place should be marked, mark it
                if (this.markedPlaces.has(metadata.id)) {
                    this.createMarker(`Place #${metadata.id}`,
                        new Vector3(metadata.centerCoordinates[0], metadata.centerCoordinates[1], metadata.centerCoordinates[2]),
                        "purple", "place", metadata.id);
                }

                this.needsRedraw = true;
            //}
        }
        catch(e) {
            Logging.InfoDev("Error loading place: " + metadata.id);
            Logging.InfoDev(e);
            Logging.InfoDev(metadata);
        }
    }

    private getMaxDrawDistance(): number {
        const w = (this.orthoCam.orthoRight! - this.orthoCam.orthoLeft!) * 0.5;
        const h = (this.orthoCam.orthoTop! - this.orthoCam.orthoBottom!) * 0.5;

        return Math.max(w,h);
    }

    // TODO: go over this again.
    public updateWorld() {
        const cameraPos = this.orthoCam.getTarget();

        // Update current place.
        // TODO: only occasionally check. maybe based on distance or time.

        this.sunLight.update(cameraPos);

        // Update world when camera has moved a certain distance.
        if(!this.worldUpdatePending && this.viewUpdated && performance.now() - this.lastWorldUpdateTime > 500)
        {
            this.worldUpdatePending = true;
            this.viewUpdated = false;
            this.lastWorldUpdateTime = performance.now();

            // TEMP: do this asynchronously, getting lots of metadata
            // from storage is kinda slow.
            // TODO: Maybe have a position cache?
            (async () => {
                try {
                    //const start_time = performance.now();

                    // Increase max distance to reduce pop-in.
                    const distance = this.getMaxDrawDistance() * 1.1;
                    const gridCell = await this.implicitWorldGrid.getPlacesForPosition(cameraPos.x, 0, cameraPos.z, this.worldPlaceCount, distance);

                    // TODO: currently we don't delete places at all. Maybe we should.
                    // Check all loaded places for distance and remove or update LOD
                    /*this.places.forEach((v, k) => {
                        // Multiply draw distance with small factor here to avoid imprecision and all that
                        if(Vector3.Distance(playerPos, v.origin) > distance * 1.2) {
                            this.places.delete(k);
                            v.dispose();
                        }
                    });*/

                    const places_to_fetch: number[] = []

                    gridCell.forEach((c) => {
                        c.places.forEach((id) => {
                            if (!this.places.has(id)) places_to_fetch.push(id);
                        });
                    });

                    (await Metadata.getPlaceMetadataBatch(places_to_fetch)).forEach((m) => {
                        this.loadPlace(m);
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
    }
}