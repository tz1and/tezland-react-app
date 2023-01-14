import { Texture } from "@babylonjs/core/Materials/Textures";
import { Color3, Vector2 } from "@babylonjs/core/Maths/math";
import { Mesh, MeshBuilder, TransformNode } from "@babylonjs/core/Meshes";
import { WaterMaterial } from "@babylonjs/materials/water";
import { BaseWorld } from "../BaseWorld";
import waterbump from "../../models/waterbump.png";


export default class Water extends TransformNode {
    readonly material: WaterMaterial;
    private waterMesh: Mesh;

    private world: BaseWorld;

    constructor(name: string, world: BaseWorld, isPure?: boolean) {
        const scene = world.game.scene;
        
        super(name, scene, isPure);

        this.world = world;

        // The worlds water.
        const waterMaterial = new WaterMaterial("water", scene, new Vector2(512, 512));
        waterMaterial.backFaceCulling = false;
        const bumpTexture = new Texture(waterbump, scene);
        bumpTexture.uScale = 4;
        bumpTexture.vScale = 4;
        waterMaterial.bumpTexture = bumpTexture;
        waterMaterial.windForce = -1;
        waterMaterial.waveHeight = 0; //0.05;
        waterMaterial.bumpHeight = 0.15;
        waterMaterial.windDirection = new Vector2(1, 1);
        waterMaterial.waterColor = new Color3(0.02, 0.06, 0.24);
        waterMaterial.colorBlendFactor = 0.7;
        this.material = waterMaterial

        const water = MeshBuilder.CreateGround("water", {width: 2000.0, height: 2000.0, subdivisions: 4}, world.game.scene);
        water.material = this.material;
        water.isPickable = true;
        water.checkCollisions = false;
        water.receiveShadows = true;
        water.position.y = -3;
        water.parent = this;
        this.waterMesh = water;

        /*const water2 = MeshBuilder.CreateGround("water", {width: 2000.0, height: 2000.0, subdivisions: 4}, world.game.scene);
        water2.material = this.material;
        water2.isPickable = true;
        water2.checkCollisions = false;
        water2.receiveShadows = true;
        water2.position.y = this.waterLevel;
        water2.parent = this;
        water2.rotate(Vector3.Forward(), Angle.FromDegrees(180).radians());*/
        //this.waterMesh = water;

        this.eyesUnderwater = false;
        this.bodyUnderwater = false;
        world.game.playerController.isUnderwater = false;

        world.game.scene.registerBeforeRender(this.updateWater);
    }

    public get waterLevel() { return this.waterMesh.position.y; }
    public set waterLevel(waterLevel: number) { this.waterMesh.position.y = waterLevel; }

    public override dispose(doNotRecurse?: boolean, disposeMaterialAndTextures?: boolean): void {
        super.dispose(doNotRecurse, disposeMaterialAndTextures);

        this.getScene().unregisterBeforeRender(this.updateWater);

        // Also make sure the player isn't marked underwater anymore.
        this.world.game.playerController.isUnderwater = false;
    }

    private eyesUnderwater: boolean;
    private bodyUnderwater: boolean;

    /**
     * NOTES: Maybe make sense to do the fog in a post processing effect
     * at some point, as this method is pretty lame. Maybe it's ok.
     */

    private updateIsUnderwater() {
        const player = this.world.game.playerController;
        const camera = player.camera;
        
        const eyes_underwater = camera.globalPosition.y < this.waterLevel;

        if (this.eyesUnderwater !== eyes_underwater) {
            this.eyesUnderwater = eyes_underwater;

            const scene = this.world.game.scene;
            if (this.eyesUnderwater) {
                scene.fogColor = new Color3(0.1, 0.12, 0.22);
                scene.fogDensity = 0.05;
            }
            else {
                scene.fogColor = BaseWorld.FogSettings.color;
                scene.fogDensity = BaseWorld.FogSettings.density;
            }
        }

        const body_underwater = player.getPosition().y + 0.8 < this.waterLevel;

        if (this.bodyUnderwater !== body_underwater) {
            this.bodyUnderwater = body_underwater;

            if (this.bodyUnderwater) {
                player.isUnderwater = this.bodyUnderwater;
            }
            else {
                player.isUnderwater = this.bodyUnderwater;
            }
        }
    }

    private updateWater = () => {
        this.updateIsUnderwater();
    }
}