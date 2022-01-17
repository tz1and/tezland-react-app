import React from 'react';
import '@babylonjs/loaders/glTF';
import { ArcRotateCamera, Color4, Engine, HemisphericLight, Mesh,
    Nullable, Scene, SceneLoader, Tools, TransformNode, Vector3 } from "@babylonjs/core";


type ModelPreviewProps = {
    file?: File;
};

type ModelPreviewState = {
    loading: boolean;
    thumbnail: any;
};

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

    async loadObject(file?: File) {
        if(this.previewObject) {
             this.previewObject.dispose();
             this.previewObject = null;
        }

        if(!file) return;

        const result = await SceneLoader.ImportMeshAsync('', '', file, this.scene, null); //, '.glb');
        this.previewObject = result.meshes[0] as Mesh;

        const {min, max} = this.previewObject.getHierarchyBoundingVectors(true);
        const extent = max.subtract(min);

        const extent_max = Math.max(Math.max(extent.x, extent.y), extent.z);

        // Scale and move object based on extent.
        const new_scale = 6 / extent_max;
        this.previewObject.scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));

        this.previewObject.position.y = -extent.y * new_scale / 2;
    }

    getScreenshot(): Promise<string> {
        return Tools.CreateScreenshotAsync(this.engine, this.scene.activeCamera!, 350);
    }
}

class ModelPreview extends React.Component<ModelPreviewProps, ModelPreviewState> {
    state: ModelPreviewState = {
        // optional second annotation for better type inference
        loading: false,
        thumbnail: null
        //count: 0,
        //mount: null
    };

    private mount: HTMLCanvasElement | null;
    private preview: PreviewScene | null;

    constructor(props: ModelPreviewProps) {
        super(props);
        this.mount = null
        this.preview = null;
      }

    componentDidUpdate(prevProps: ModelPreviewProps, prevState: ModelPreviewState) {
        // did the file change?
        // if yes, update the preview.
        if(this.props.file !== prevProps.file) {
            // if file is not null and preview exists.
            if(this.preview) {
                this.preview.loadObject(this.props.file);
            }
        }
    }

    componentDidMount() {
        this.preview = new PreviewScene(this.mount!);
    }

    getThumbnail(): Promise<string> {
        return this.preview!.getScreenshot();
    }

    render() {
        return (
        <div>
            <canvas className='img-thumbnail mt-2' id="previewCanvas" touch-action="none" width={350} height={350} ref={ref => (this.mount = ref)} ></canvas><br/>
            <small>The image will be used for the preview thumbnail.<br/><br/>

            Use the mouse to control the view.<br/><br/>
            Mouse wheel: zoom<br/>
            Left mouse: rotate<br/>
            Right mouse: pan<br/></small>
        </div>);
    }
}

export default ModelPreview;