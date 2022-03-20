import React from 'react';
import '@babylonjs/loaders/glTF';
import { ArcRotateCamera, Color4, DirectionalLight, Engine, HemisphericLight, Mesh,
    Nullable, Scene, SceneLoader, Tools, TransformNode, Vector3 } from "@babylonjs/core";
import { countPolygons, getFileType } from '../utils/Utils';


class PreviewScene {

    private engine: Engine;
    private scene: Scene;
    private canvas: HTMLCanvasElement;

    private previewObject: Nullable<TransformNode>;

    constructor(mount: HTMLCanvasElement) {
        // Get the canvas element from the DOM.
        this.canvas = mount;

        // Associate a Babylon Engine to it.
        this.engine = new Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
        this.engine.disableManifestCheck = true;

        // Create our first scene.
        this.scene = this.createScene();

        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        this.previewObject = null;
    }

    public dispose() {
        // Destorying the engine should prbably be enough.
        this.engine.dispose();
        this.scene.dispose();
    }

    public setBgColor(color: string) {
        this.scene.clearColor = Color4.FromHexString(color);
    }

    private createScene() {
        var scene = new Scene(this.engine);

        scene.collisionsEnabled = false;

        const camera = new ArcRotateCamera("camera", Math.PI / 1.5, Math.PI / 2.5, 11, new Vector3(0, 0, 0), scene);
        camera.wheelPrecision = 25;
        camera.attachControl(this.canvas, true);

        const hemi_light = new HemisphericLight("light", new Vector3(0.1, 1, 0.1), scene);
        hemi_light.intensity = 0.5;

        const dir_light = new DirectionalLight("light2", new Vector3(1,-1,-1), this.scene);
        dir_light.intensity = 0.6;

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

    getScreenshot(res: number): Promise<string> {
        return Tools.CreateScreenshotUsingRenderTargetAsync(this.engine, this.scene.activeCamera!, res, "image/png", this.engine.getCaps().maxSamples, true);
    }
}

export type ModelLoadingState = 'none' | 'success' | 'failed';
type ModelLoadedCallback = (loadingState: ModelLoadingState, modelFileSize: number, polyCount: number) => void;

type ModelPreviewProps = {
    file?: File | undefined;
    modelLoaded: ModelLoadedCallback;
};

type ModelPreviewState = {
    loading: boolean;
    thumbnail: any;
    polycount: number;
};

class ModelPreview extends React.Component<ModelPreviewProps, ModelPreviewState> {
    private mount = React.createRef<HTMLCanvasElement>();
    private preview: PreviewScene | null;

    constructor(props: ModelPreviewProps) {
        super(props);
        this.state = {
            // optional second annotation for better type inference
            loading: false,
            thumbnail: null,
            polycount: -1,
            //count: 0,
            //mount: null
        };
        this.preview = null;
      }

      override componentDidUpdate(prevProps: ModelPreviewProps) {
        // did the file change?
        // if yes, update the preview.
        if(this.props.file !== prevProps.file) {
            // if file is not null and preview exists.
            if(this.preview) {
                this.preview.loadObject(this.props.modelLoaded, this.props.file).then((res) => {
                    this.setState({ polycount: res });
                });
            }
        }
    }

    override componentDidMount() {
        if(this.mount.current) {
            this.preview = new PreviewScene(this.mount.current);
        }
    }

    override componentWillUnmount() {
        if(this.preview) {
            this.preview.dispose();
            this.preview = null;
        }
    }

    getThumbnail(res: number): Promise<string> {
        return this.preview!.getScreenshot(res);
    }

    override render() {
        return (
        <div>
            <canvas className='img-thumbnail mt-2' id="previewCanvas" touch-action="none" width={350} height={350} ref={this.mount} ></canvas>
            <p className='align-middle mb-2'>Background color: <input type="color" id="backgroundColorPicker" defaultValue="#DDEEFF" onChange={(col) => this.preview?.setBgColor(col.target.value)}/></p>
            <div className='bg-info bg-info p-3 text-dark rounded small mb-2'>The image will be used for the preview thumbnail.<br/>
                Use the mouse to control the view.<br/><br/>
                Mouse wheel: zoom<br/>
                Left mouse: rotate<br/>
                Right mouse: pan</div>
        </div>);
    }
}

export default ModelPreview;