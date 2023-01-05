import React from 'react';
import { SkyMaterial } from '@babylonjs/materials';
import { ArcRotateCamera, Color3, Color4, Engine, FreeCamera, HemisphericLight, Mesh,
    Nullable, ReflectionProbe, RenderTargetTexture, Scene, SceneLoader, Tools, TransformNode, Vector3 } from "@babylonjs/core";
import { countPolygons, getFileType } from '../utils/Utils';
import SunLight from '../world/nodes/SunLight';
import assert from 'assert';
import ArtifactProcessingQueue from '../utils/ArtifactProcessingQueue';
import ArtifactDownload from '../utils/ArtifactDownload';
import BabylonUtils from '../world/BabylonUtils';
import TokenKey from '../utils/TokenKey';
import { instantiateOptions } from '../utils/ArtifactMemCache';


class PreviewScene {

    private engine: Engine;
    private scene: Scene;

    private previewObject: Nullable<TransformNode>;

    constructor(engine: Engine) {
        // Get the canvas element from the DOM.
        this.engine = engine;

        // Create our first scene.
        this.scene = this.createScene();

        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        this.previewObject = null;
    }

    public dispose() {
        // Destorying the engine should prbably be enough.
        this.scene.dispose();
        this.engine.dispose();
    }

    public setBgColor(color: string) {
        this.scene.clearColor = Color4.FromHexString(color);
    }

    private createScene() {
        var scene = new Scene(this.engine);

        scene.collisionsEnabled = false;

        const canvas = this.engine.getRenderingCanvas();
        assert(canvas, "Engine not attached to a canvas element");

        const camera = new ArcRotateCamera("camera", Math.PI / 1.5, Math.PI / 2.5, 11, new Vector3(0, 0, 0), scene);
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
        //skyMaterial.inclination = 0.25;
        //skyMaterial.turbidity = 1;
        //skyMaterial.rayleigh = 3;
        //skyMaterial.luminance = 0.3;
        skyMaterial.useSunPosition = true;
        skyMaterial.sunPosition = sun_direction.scale(-1);

        let skybox = Mesh.CreateBox("skyBox", 1000.0, skyScene);
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

    async loadObject(modelLoaded: ModelLoadedCallback, file?: File): Promise<number> {
        // Tell the mint form the model is unloaded/false.
        modelLoaded('none', 0, 0);

        if(this.previewObject) {
             this.previewObject.dispose();
             this.previewObject = null;
        }

        if(!file) return -1;

        try {
            // TODO: use asset container.
            const file_type = await getFileType(file);
            const result = await SceneLoader.ImportMeshAsync('', '', file, this.scene, null, '.' + file_type);
            // remove all lights.
            result.lights.forEach((l) => { l.dispose(); });
            // stop animations
            result.animationGroups.forEach((ag) => { ag.stop(); })
            this.previewObject = result.meshes[0] as Mesh;

            const {min, max} = this.previewObject.getHierarchyBoundingVectors(true);
            const extent = max.subtract(min);

            const extent_max = Math.max(Math.max(extent.x, extent.y), extent.z);

            // Scale and move object based on extent.
            const new_scale = 6 / extent_max;
            this.previewObject.scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));

            this.previewObject.position.y = -extent.y * new_scale / 2;

            const polycount = countPolygons(result.meshes);
            //Logging.Log("polycount", polycount);

            // Model loaded successfully.
            modelLoaded('success', file.size, polycount);

            return polycount;
        }
        catch {
            modelLoaded('failed', 0, 0);

            return -1;
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
            const asset = await ArtifactDownload.downloadArtifact(tokenKey, Infinity, Infinity, Infinity).then(res => ArtifactProcessingQueue.queueProcessArtifact(res, this.scene));

            // Instantiate.
            // Getting first root node is probably enough.
            // Note: imported glTFs are rotate because of the difference in coordinate systems.
            // Don't flip em.
            // NOTE: when an object is supposed to animate, instancing won't work.
            // NOTE: using doNotInstantiate predicate to force skinned meshes to instantiate. https://github.com/BabylonJS/Babylon.js/pull/12764
            const instance = asset.object.instantiateModelsToScene(undefined, false, instantiateOptions());
            this.previewObject = instance.rootNodes[0];

            const {min, max} = this.previewObject.getHierarchyBoundingVectors(true);
            const extent = max.subtract(min);

            const extent_max = Math.max(Math.max(extent.x, extent.y), extent.z);

            // Scale and move object based on extent.
            const new_scale = 6 / extent_max;
            this.previewObject.scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));

            this.previewObject.position.y = -extent.y * new_scale / 2;

            const polycount = countPolygons(asset.object.meshes);
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
};

type ModelPreviewState = {
    loading: boolean;
    thumbnail: any;
    polycount: number;
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
        // did the file change?
        // if yes, update the preview.
        if(this.props.file !== prevProps.file) {
            // if file is not null and preview exists.
            if(this.state.preview) {
                this.state.preview.loadObject(this.props.modelLoaded, this.props.file).then((res) => {
                    this.setState({ polycount: res });
                });
            }
        }
    }

    override componentDidMount() {
        assert(this.mount.current);

        BabylonUtils.createEngine(this.mount.current).then(engine => {
            try {
                this.setState({preview: new PreviewScene(engine)}, () => {
                    assert(this.state.preview);
                    if(this.props.tokenKey) {
                        this.state.preview.loadFromTokenKey(this.props.modelLoaded, this.props.tokenKey).then((res) => {
                            this.setState({ polycount: res });
    
                            if(this.loadingRef.current) this.loadingRef.current.hidden = true;
                        });
                    }
                    else if(this.loadingRef.current) this.loadingRef.current.hidden = true;
                });
            }
            catch(err: any) { }
        }).catch(err => {});
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