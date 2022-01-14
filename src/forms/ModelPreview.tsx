import React from 'react';
import '@babylonjs/loaders/glTF';
import { ArcRotateCamera, Engine, HemisphericLight, Mesh,
    Nullable, Scene, SceneLoader, Tools, TransformNode, Vector3 } from "@babylonjs/core";


type ModelPreviewProps = {
    file: File | null;
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
    
        // Add a camera to the scene and attach it to the canvas
        // Add a lights to the scene
    
        //Your Code
    
      return scene;
    };

    async loadObject(file: File) {
        if(this.previewObject) {
             this.previewObject.dispose();
             this.previewObject = null;
        }

        const result = await SceneLoader.ImportMeshAsync('', '', file, this.scene, null); //, '.glb');

        // todo: scale the object to fit into view?

        //this.previewObject = result.transformNodes[0];

        this.previewObject = result.meshes[0] as Mesh;

        const {min, max} = this.previewObject.getHierarchyBoundingVectors(true);
        const extent = max.subtract(min);

        const extent_max = Math.max(Math.max(extent.x, extent.y), extent.z);

        const new_scale = 6 / extent_max;
        this.previewObject.scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));

        // TODO: set camera based on extent.
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
            if(this.props.file && this.preview) {
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
            The image will be used for the preview thumbnail.<br/><br/>

            Use the mouse to control the view.<br/><br/>
            Mouse wheel: zoom<br/>
            Left mouse: rotate<br/>
            Right mouse: pan<br/>
        </div>);
    }
}

export default ModelPreview;