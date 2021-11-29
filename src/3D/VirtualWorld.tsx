import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky';
import FirstPersonControls from './FirstPersonControls'

class VirtualWorld {
    mesh: THREE.Mesh;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    clock: THREE.Clock;
    fpsControls: FirstPersonControls;

    constructor(mount: HTMLDivElement, appControlfunctions: any) {
        this.clock = new THREE.Clock();

        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;
        this.renderer.shadowMap.enabled = true;
        //renderer.shadowMap.autoUpdate = false;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
        mount.appendChild( this.renderer.domElement );

        window.addEventListener( 'resize', () => this.onWindowResize(), false );

        // Init the scene
        this.camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 10 );
        this.camera.position.y = 0.3;
        this.camera.position.z = 1;
        this.camera.lookAt(new THREE.Vector3(0,0.15,0));

        this.scene = new THREE.Scene();

        const geometry = new THREE.BoxGeometry( 0.2, 0.2, 0.2 );
        const material = new THREE.MeshPhongMaterial();
        material.color.set(0xF22356)

        const material2 = new THREE.MeshPhongMaterial();
        material2.color.set(0xDDDDDD)

        const plane_geom = new THREE.PlaneGeometry(1000,1000);
        const plane_mesh = new THREE.Mesh( plane_geom, material2 );
        plane_mesh.rotateX(THREE.MathUtils.degToRad(-90));
        plane_mesh.receiveShadow = true;
        this.scene.add(plane_mesh);

        this.mesh = new THREE.Mesh( geometry, material );
        this.mesh.position.y = 0.2;
        this.mesh.castShadow = true;
        this.scene.add( this.mesh );

        for(let x = 0; x < 1000; ++x) {
            const box_mesh = new THREE.Mesh( geometry, material2 );
            box_mesh.position.x = THREE.MathUtils.randFloat(-10, 10);
            box_mesh.position.z = THREE.MathUtils.randFloat(-10, 10);
            box_mesh.position.y = 0.101
            box_mesh.castShadow = true;
            box_mesh.receiveShadow = true;
            this.scene.add( box_mesh );
        }

        this.initSky();

        this.fpsControls = new FirstPersonControls(this.camera, this.scene, appControlfunctions);
    }

    /*init(this.mount!);
    animate();*/

    /*contracts.getItemsForPlace(0).then(the_map => {
    const geometry = new THREE.BoxGeometry( 0.2, 0.2, 0.2 );
    const material = new THREE.MeshPhongMaterial();
    material.color.set(0xDDDDDD);

    the_map.forEach((element: any) => {
        console.log(element.children[2].value);

        const box_mesh = new THREE.Mesh( geometry, material );
        box_mesh.position.x = THREE.MathUtils.randFloat(-2, 2);
        box_mesh.position.z = THREE.MathUtils.randFloat(-2, 2);
        box_mesh.position.y = 0.101
        box_mesh.castShadow = true;
        box_mesh.receiveShadow = true;
        scene.add( box_mesh );
    });

    //renderer.shadowMap.needsUpdate = true;
    });*/

    initSky() {
        // Add Sky
        const sky = new Sky();
        sky.scale.setScalar( 450000 );
        this.scene.add( sky );

        const sun = new THREE.Vector3();

        const effectController = {
            turbidity: 8,
            rayleigh: 0.1,
            mieCoefficient: 0.007,
            mieDirectionalG: 0.7,
            elevation: 45,
            azimuth: 165,
            exposure: this.renderer.toneMappingExposure
        };

        const uniforms = sky.material.uniforms;
        uniforms[ 'turbidity' ].value = effectController.turbidity;
        uniforms[ 'rayleigh' ].value = effectController.rayleigh;
        uniforms[ 'mieCoefficient' ].value = effectController.mieCoefficient;
        uniforms[ 'mieDirectionalG' ].value = effectController.mieDirectionalG;

        const phi = THREE.MathUtils.degToRad( 90 - effectController.elevation );
        const theta = THREE.MathUtils.degToRad( effectController.azimuth );

        sun.setFromSphericalCoords( 1, phi, theta );

        uniforms[ 'sunPosition' ].value.copy( sun );

        this.renderer.toneMappingExposure = effectController.exposure;

        var light = new THREE.DirectionalLight( 0xffffff );
        light.position.copy(sun.multiplyScalar(100));
        //light.castShadow = true;
        light.shadow.mapSize.width = 1024; // default
        light.shadow.mapSize.height = 1024; // default
        light.shadow.camera.near = 0.5; // default
        light.shadow.camera.far = 500; // default
        this.scene.add(light);

        const ambient_light = new THREE.AmbientLight( 0x202026 ); // soft white light
        this.scene.add( ambient_light );
    }

    animate() {
        requestAnimationFrame( () => this.animate() );

        this.mesh.rotation.x += 0.01;
        this.mesh.rotation.y += 0.02;

        var delta = this.clock.getDelta();

        this.fpsControls.processInput(delta);

        this.render();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }

    render() {
        this.renderer.render( this.scene, this.camera );
    }
};

export default VirtualWorld;