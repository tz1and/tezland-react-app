import React from 'react';
import { ArcRotateCamera, Color3, Color4, Engine, FreeCamera, HemisphericLight, Mesh,
    MeshBuilder, Nullable, ReflectionProbe, RenderTargetTexture,
    Scene, SceneLoader, StandardMaterial, Tools, TransformNode, Vector3 } from "@babylonjs/core";
import { SkyMaterial } from "@babylonjs/materials";
import { getFileType, isImageFile } from '../utils/Utils';
import SunLight from '../world/nodes/SunLight';
import assert from 'assert';
import ArtifactProcessingQueue from '../utils/ArtifactProcessingQueue';
import ArtifactDownload from '../utils/ArtifactDownload';
import BabylonUtils from '../world/BabylonUtils';
import TokenKey from '../utils/TokenKey';
import ArtifactMemCache from '../utils/ArtifactMemCache';
import { MeshUtils } from '../utils/MeshUtils';
import { Logging } from '../utils/Logging';
import { createFrameForImage, defaultFrameParams, FrameParams } from '../utils/FrameImage';


class PreviewScene {

    private engine: Engine;
    private scene: Scene;

    private previewObject: Nullable<TransformNode>;

    private assetGroup: TransformNode;

    constructor(engine: Engine) {
        // Get the canvas element from the DOM.
        this.engine = engine;

        // Create our first scene.
        this.scene = this.createScene();

        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        this.previewObject = null;

        this.assetGroup = new TransformNode("assets", this.scene)
        this.assetGroup.setEnabled(false);
    }

    public async initialise() {
        return ArtifactMemCache.initialise(this.assetGroup, false);
    }

    public dispose() {
        ArtifactMemCache.dispose().finally(() => {
            // Babylon needs to be destroyed after the worker threads.
            // I THINK!
            // Destorying the engine should prbably be enough.
            this.scene.dispose();
            this.engine.dispose();
        });
    }

    public setBgColor(color: string) {
        this.scene.clearColor = Color4.FromHexString(color);
    }

    private createScene() {
        let scene = new Scene(this.engine);

        scene.collisionsEnabled = false;

        const canvas = this.engine.getRenderingCanvas();
        assert(canvas, "Engine not attached to a canvas element");

        const camera = new ArcRotateCamera("camera", Math.PI / -1.5, Math.PI / 2.5, 11, new Vector3(0, 0, 0), scene);
        camera.wheelPrecision = 25;
        camera.attachControl(canvas, false);
        
        // Create sun and skybox
        const sun_direction = new Vector3(-50, -100, 50).normalize();
        new SunLight("sunLight", sun_direction, scene);

        const ambient_light = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), scene);
        ambient_light.intensity = 0.25;
        ambient_light.diffuse = new Color3(0.7, 0.7, 1);
        ambient_light.specular = new Color3(1, 1, 0.7);
        ambient_light.groundColor = new Color3(1, 1, 0.7);

        // Create a scene for rendering the reflection probe.
        let skyScene = new Scene(this.engine);

        const skyMaterial = new SkyMaterial("skyMaterial", skyScene);
        skyMaterial.backFaceCulling = false;
        //skyMaterial.fogEnabled = false;
        skyMaterial.useSunPosition = true;
        skyMaterial.sunPosition = sun_direction.scale(-1);
        skyMaterial.dithering = true;

        const skybox = MeshBuilder.CreateIcoSphere("skyBox", {subdivisions: 8, radius: 1000.0, sideOrientation: Mesh.BACKSIDE}, skyScene);
        //this.skybox.infiniteDistance = true; // What does this do?
        skybox.material = skyMaterial;

        // reflection probe
        let reflectionProbe = new ReflectionProbe('reflectionProbe', 256, skyScene);
        assert(reflectionProbe.renderList);
        reflectionProbe.renderList.push(skybox);
        reflectionProbe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;

        new FreeCamera("camera", new Vector3(0, 0, 0), skyScene);

        // render reflection.
        skyScene.render();

        // and set probe's texture as env texture.
        scene.environmentTexture = reflectionProbe.cubeTexture;

        scene.clearColor = Color4.FromHexString("#DDEEFF");
    
        return scene;
    };

    updateFrame(color: string) {
        if(this.previewObject) {
            // Find the frame mesh.
            for (const mesh of this.previewObject.getChildMeshes()) {
                if (mesh.name === "frame") {
                    assert(mesh.material instanceof StandardMaterial);
                    mesh.material.diffuseColor = Color3.FromHexString(color);
                    return;
                }
            }
        }
    }

    private scaleAndCenterVertically(object: TransformNode) {
        const {min, max} = object.getHierarchyBoundingVectors(true);
        const extent = max.subtract(min);

        const extent_max = Math.max(Math.max(extent.x, extent.y), extent.z);

        // Scale and move object based on extent.
        const new_scale = 6 / extent_max;
        object.scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));

        // Center the object in height by its extent.
        object.position.y = (extent.y / 2 + min.y) * -new_scale;
    }

    async loadObject(modelLoaded: ModelLoadedCallback, file: File | undefined, frameOpts: {ratio: number, color: string}): Promise<[number, FrameParams | undefined]> {
        // Tell the mint form the model is unloaded/false.
        modelLoaded('none', 0, 0);

        if(this.previewObject) {
             this.previewObject.dispose();
             this.previewObject = null;
        }

        if(!file) {
            Logging.ErrorDev("File not set.")
            return [-1, undefined];
        }

        try {
            // TODO: use asset container.
            const file_type = await getFileType(file);

            Logging.InfoDev("Loading file:", file.name);

            let frameParams: FrameParams | undefined;
            let polycount = 0;
            if (isImageFile(file_type)) {
                const res = await createImageBitmap(file);
                // Copy default frame params.
                frameParams = {} as FrameParams;
                Object.assign(frameParams, defaultFrameParams);
                frameParams.frame.frameRatio = frameOpts.ratio;
                Color3.FromHexString(frameOpts.color).toArray(frameParams.frameMat.diffuseColor);
                this.previewObject = createFrameForImage(file, {width: res.width, height: res.height}, frameParams, this.scene, null);
                res.close();
            }
            else {
                const result = await SceneLoader.ImportMeshAsync('', '', file, this.scene, null, '.' + file_type);
                // remove all lights.
                result.lights.forEach((l) => { l.dispose(); });
                // stop animations
                result.animationGroups.forEach((ag) => { ag.stop(); })
                this.previewObject = result.meshes[0] as Mesh;

                polycount = MeshUtils.countPolygons(result.meshes);
            }

            this.scaleAndCenterVertically(this.previewObject);

            //Logging.Log("polycount", polycount);

            // Model loaded successfully.
            modelLoaded('success', file.size, polycount);

            return [polycount, frameParams];
        }
        catch(e) {
            Logging.ErrorDev(e);
            modelLoaded('failed', 0, 0);

            return [-1, undefined];
        }
    }

    async loadFromTokenKey(modelLoaded: ModelLoadedCallback, tokenKey: TokenKey): Promise<number> {
        // Tell the mint form the model is unloaded/false.
        modelLoaded('none', 0, 0);

        if(this.previewObject) {
             this.previewObject.dispose();
             this.previewObject = null;
        }

        try {
            const refcountedAsset = await ArtifactDownload.downloadArtifact(tokenKey, Infinity, Infinity, Infinity).then(res => ArtifactProcessingQueue.queueProcessArtifact(res, this.scene, this.assetGroup));

            this.previewObject = refcountedAsset.object.instantiate(null, "previeModel");

            this.scaleAndCenterVertically(this.previewObject);

            const polycount = MeshUtils.countPolygons(refcountedAsset.object.asset.meshes);
            //Logging.Log("polycount", polycount);

            // Model loaded successfully.
            modelLoaded('success', 0, polycount);

            return polycount;
        }
        catch {
            modelLoaded('failed', 0, 0);

            return -1;
        }
    }

    public async getScreenshot(res: number): Promise<string> {
        // call render to make sure everything is ready.
        this.scene.render();
        // take screenshot in requested res.
        const screenshot = await Tools.CreateScreenshotUsingRenderTargetAsync(this.engine, this.scene.activeCamera!, res, "image/png", this.engine.getCaps().maxSamples, true);
        // call render again, for good measure.
        this.scene.render();
        
        return screenshot;
    }
}

export type ModelLoadingState = 'none' | 'success' | 'failed';
type ModelLoadedCallback = (loadingState: ModelLoadingState, modelFileSize: number, polyCount: number) => void;

type ModelPreviewProps = {
    file?: File | undefined;
    tokenKey?: TokenKey | undefined;
    modelLoaded: ModelLoadedCallback;
    width?: number;
    height?: number;
    bgColorSelection?: boolean;
    frameColor?: string | undefined;
    frameRatio?: number | undefined;
};

type ModelPreviewState = {
    loading: boolean;
    thumbnail: any;
    polycount: number;
    frameParams?: FrameParams | undefined;
    preview: PreviewScene | null;
};

class ModelPreview extends React.Component<ModelPreviewProps, ModelPreviewState> {
    private mount = React.createRef<HTMLCanvasElement>();
    private loadingRef = React.createRef<HTMLHeadingElement>();

    constructor(props: ModelPreviewProps) {
        super(props);
        this.state = {
            loading: false,
            thumbnail: null,
            polycount: -1,
            preview: null
        };
    }

    override componentDidUpdate(prevProps: ModelPreviewProps) {
        // File or frame changed, update the preview.
        if(this.props.file !== prevProps.file ||
            this.props.frameRatio !== prevProps.frameRatio) {
            // TODO: is it correct to assert this?
            assert(this.props.frameRatio !== undefined && this.props.frameColor !== undefined);
            if(this.state.preview) {
                this.state.preview.loadObject(this.props.modelLoaded, this.props.file, {ratio: this.props.frameRatio, color: this.props.frameColor}).then(([polycount, frameParams]) => {
                    this.setState({ polycount: polycount, frameParams: frameParams });
                });
            }
        }

        // Frame color changed.
        if(this.props.frameColor !== prevProps.frameColor) {
            // TODO: is it correct to assert this?
            assert(this.props.frameColor !== undefined);
            if(this.state.preview) {
                this.state.preview.updateFrame(this.props.frameColor);
            }
        }
    }

    override componentDidMount() {
        assert(this.mount.current);

        try {
            BabylonUtils.createEngine(this.mount.current).then(engine => {
                this.setState({preview: new PreviewScene(engine)}, async () => {
                    assert(this.state.preview);
                    await this.state.preview.initialise();
                    if(this.props.tokenKey) {
                        const res = await this.state.preview.loadFromTokenKey(this.props.modelLoaded, this.props.tokenKey);
                        this.setState({ polycount: res });
                        if(this.loadingRef.current) this.loadingRef.current.hidden = true;
                    }
                    else if(this.loadingRef.current) this.loadingRef.current.hidden = true;
                });
            });
        }
        catch(err) { }
    }

    override componentWillUnmount() {
        if(this.state.preview) {
            this.state.preview.dispose();
        }
    }

    getThumbnail(res: number): Promise<string> {
        return this.state.preview!.getScreenshot(res);
    }

    override render() {
        return (
        <div className='position-relative'>
            <h4 className="position-absolute p-3 start-0 bottom-0" ref={this.loadingRef}>Loading...</h4>
            <canvas className='img-thumbnail mt-2' id="previewCanvas" touch-action="none" width={this.props.width} height={this.props.height} ref={this.mount} />
            { this.props.bgColorSelection && <p className='align-middle mb-2'>Background color: <input type="color" id="backgroundColorPicker" defaultValue="#DDEEFF" onChange={(col) => this.state.preview?.setBgColor(col.target.value)}/></p> }
        </div>);
    }
}

export default ModelPreview;