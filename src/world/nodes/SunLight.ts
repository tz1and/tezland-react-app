import { DirectionalLight } from "@babylonjs/core/Lights";
import { Color3, Vector3 } from "@babylonjs/core/Maths";
import { Node } from "@babylonjs/core/node";
import { Scene } from "@babylonjs/core/scene";
//import { isDev } from "../utils/Utils";


export default class SunLight {
    //private dlh: Nullable<DirectionalLightFrustumViewer> = null;
    private dirLight: DirectionalLight
    
    constructor(name: string, direction: Vector3, scene: Scene) {
        this.dirLight = new DirectionalLight(name, direction, scene);
        this.dirLight.position = new Vector3(); //this.dirLight.direction.scale(-100);

        this.dirLight.intensity = 0.6;
        this.dirLight.diffuse = new Color3(1, 1, 0.95);
        this.dirLight.specular = new Color3(0.95, 0.95, 1);

        // Disable this, don't want the whole scene to be shadowed
        // and we want to be in control.
        this.dirLight.autoUpdateExtends = false;
        this.dirLight.autoCalcShadowZBounds = false;
        
        // Our frustum bounds
        this.dirLight.shadowMinZ = -100;
        this.dirLight.shadowMaxZ = 100;
        const ortho_min = -20;
        const ortho_max = 20;
        this.dirLight.orthoLeft = ortho_max;
        this.dirLight.orthoRight = ortho_min;
        this.dirLight.orthoBottom = ortho_max;
        this.dirLight.orthoTop = ortho_min;

        //if (isDev()) {
        //    this.dlh = new DirectionalLightFrustumViewer(this.dirLight, scene.activeCamera!);
        //    this.dlh.show();
        //}
    }

    public set parent(node: Node) { this.dirLight.parent = node; }

    get light() { return this.dirLight; }

    update(pos: Vector3) {
        // only update if player moved more than 1m.
        if(Vector3.Distance(pos, this.dirLight.position) > 1) {
            this.dirLight.position = pos.clone(); //.add(this.dirLight.direction.scale(-100));

            //Logging.Log(this.dirLight.position);
            //Logging.Log(this.dirLight.direction);

            //this.dlh?.update();
        }
    }
}