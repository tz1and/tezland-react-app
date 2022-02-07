import { DirectionalLight, Scene, Vector3 } from "@babylonjs/core";
//import { Nullable, DirectionalLightFrustumViewer } from '@babylonjs/core';
//import { isDev } from "../utils/Utils";


export default class SunLight {
    //private dlh: Nullable<DirectionalLightFrustumViewer> = null;
    private dirLight: DirectionalLight
    
    constructor(name: string, direction: Vector3, scene: Scene) {
        this.dirLight = new DirectionalLight(name, direction, scene);
        this.dirLight.position = new Vector3(); //this.dirLight.direction.scale(-100);

        this.dirLight.intensity = 0.5;

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

    get light() { return this.dirLight; }

    update(pos: Vector3) {
        this.dirLight.position = pos.clone(); //.add(this.dirLight.direction.scale(-100));

        //console.log(this.dirLight.position);
        //console.log(this.dirLight.direction);

        //this.dlh?.update();
    }
}