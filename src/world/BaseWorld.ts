import { CascadedShadowGenerator, DirectionalLight, ShadowGenerator } from "@babylonjs/core/Lights";
import { Color3 } from "@babylonjs/core/Maths";
import { AbstractMesh, TransformNode } from "@babylonjs/core/Meshes";
import AppSettings from "../storage/AppSettings";
import { Logging } from "../utils/Logging";
import { Game } from "./Game";

export abstract class BaseWorld {
    readonly game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    public loadWorld() {
        if (this.game.scene.isReady(false)) {
            this._loadWorld().catch((e) => {
                Logging.Error("Loading world failed:", e);
            });
        } else {
            this.game.scene.onReadyObservable.addOnce(() => {
                this._loadWorld().catch((e) => {
                    Logging.Error("Loading world failed:", e);
                });
            });
        }
    }

    protected createShadowGenerator(light: DirectionalLight) {
        let shadowGenerator = null;

        if (AppSettings.shadowOptions.value === "standard") {
            shadowGenerator = new ShadowGenerator(AppSettings.shadowMapRes.value, light);
            shadowGenerator.frustumEdgeFalloff = 0.1;
            shadowGenerator.filter = ShadowGenerator.FILTER_PCF;
            shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
            // Self-shadow bias
            shadowGenerator.bias = 0.001;
            shadowGenerator.normalBias = 0.02;
            //shadowGenerator.useCloseExponentialShadowMap = true;
            //shadowGenerator.useExponentialShadowMap = true;
            //shadowGenerator.useBlurExponentialShadowMap = true;
            //shadowGenerator.usePoissonSampling = true;
        }
        else if (AppSettings.shadowOptions.value === "cascaded") {
            shadowGenerator = new CascadedShadowGenerator(AppSettings.shadowMapRes.value, light);
            shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
            //shadowGenerator.debug = true;
            //shadowGenerator.autoCalcDepthBounds = false;
            shadowGenerator.frustumEdgeFalloff = 0.1;
            shadowGenerator.freezeShadowCastersBoundingInfo = true;
            shadowGenerator.stabilizeCascades = true;
            shadowGenerator.shadowMaxZ = 75;
            shadowGenerator.numCascades = 2;
            shadowGenerator.lambda = 0.6;
            // Self-shadow bias
            shadowGenerator.bias = 0.001;
            shadowGenerator.normalBias = 0.02;
            //shadowGenerator.splitFrustum();
        }

        if(shadowGenerator) {
            let rtt = shadowGenerator.getShadowMap();

            if(rtt) {
                Logging.InfoDev("Setting up custom render list for shadow generator")
                rtt.getCustomRenderList = (layer, renderList, renderListLength) => {
                    return this.shadowRenderList;
                };
            }
        }

        return shadowGenerator;
    }

    protected lastShadowListTime: number = 0;
    protected shadowRenderList: AbstractMesh[] = [];

    protected abstract updateShadowRenderList(): void;

    protected abstract _loadWorld(): Promise<void>;

    public static FogSettings = {color: new Color3(0.65, 0.68, 0.8), density: 0.00025}

    public abstract getWorldNode(): TransformNode;

    public abstract dispose(): void;
}