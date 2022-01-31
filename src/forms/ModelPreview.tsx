import React from 'react';
import '@babylonjs/loaders/glTF';
import { ArcRotateCamera, Color4, Engine, HemisphericLight, Mesh,
    Nullable, Scene, SceneLoader, Tools, TransformNode, Vector3 } from "@babylonjs/core";
import { countPolygons } from '../utils/Utils';


class PreviewScene {

    private engine: Engine;
    private scene: Scene;
    private canvas: HTMLCanvasElement;

    private previewObject: Nullable<TransformNode>;

    constructor(mount: HTMLCanvasElement) {
        // Get the canvas element from the DOM.
        this.canvas = mount;

        // Associate a Babylon Engine to it.
        this.engine = new Engine(this.canvas, true);
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

        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 15, new Vector3(0, 0, 0), scene);
        camera.wheelPrecision = 25;
        camera.attachControl(this.canvas, true);
        /*const light =*/ new HemisphericLight("light", new Vector3(0.1, 1, 0.1), scene);

        scene.clearColor = Color4.FromHexString("#503333");
    
        return scene;
    };

    async loadObject(modelLoaded: ModelLoadedCallback, file?: File): Promise<number> {
        // Tell the mint form the model is unloaded/false.
        modelLoaded('none', 0, 0);

        if(this.previewObject) {
             this.previewObject.dispose();
             this.previewObject = null;
        }

        if(!file) return 0;

        try {
            const result = await SceneLoader.ImportMeshAsync('', '', file, this.scene, null); //, '.glb');
            this.previewObject = result.meshes[0] as Mesh;

            const {min, max} = this.previewObject.getHierarchyBoundingVectors(true);
            const extent = max.subtract(min);

            const extent_max = Math.max(Math.max(extent.x, extent.y), extent.z);

            // Scale and move object based on extent.
            const new_scale = 6 / extent_max;
            this.previewObject.scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));

            this.previewObject.position.y = -extent.y * new_scale / 2;

            const polycount = countPolygons(result.meshes);

            // Model loaded successfully.
            modelLoaded('success', file.size, polycount);

            return polycount;
        }
        catch {
            modelLoaded('failed', 0, 0);

            return 0;
        }
    }

    getScreenshot(): Promise<string> {
        return Tools.CreateScreenshotAsync(this.engine, this.scene.activeCamera!, 350);
    }
}

export type ModelLoadingState = 'none' | 'success' | 'failed';
type ModelLoadedCallback = (loadingState: ModelLoadingState, modelFileSize: number, polyCount: number) => void;

// TODO: add a callback to call when model was loaded (or failed).
type ModelPreviewProps = {
    file?: File;
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
            polycount: 0,
            //count: 0,
            //mount: null
        };
        this.preview = null;
      }

    componentDidUpdate(prevProps: ModelPreviewProps, prevState: ModelPreviewState) {
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

    componentDidMount() {
        if(this.mount.current) {
            this.preview = new PreviewScene(this.mount.current);
        }
    }

    componentWillUnmount() {
        if(this.preview) {
            this.preview.dispose();
            this.preview = null;
        }
    }

    getThumbnail(): Promise<string> {
        return this.preview!.getScreenshot();
    }

    render() {
        return (
        <div>
            <canvas className='img-thumbnail mt-2' id="previewCanvas" touch-action="none" width={350} height={350} ref={this.mount} ></canvas>
            <p className='align-middle mb-2'>Background color: <input type="color" id="backgroundColorPicker" defaultValue="#503333" onChange={(col) => this.preview?.setBgColor(col.target.value)}/></p>
            <div className='bg-info bg-info p-3 text-dark rounded small mb-2'>The image will be used for the preview thumbnail.<br/>
                Use the mouse to control the view.<br/><br/>
                Mouse wheel: zoom<br/>
                Left mouse: rotate<br/>
                Right mouse: pan</div>
        </div>);
    }
}

export default ModelPreview;