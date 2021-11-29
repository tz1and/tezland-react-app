import * as THREE from 'three';
import * as fastpng from 'fast-png';


export default function renderToTexture() {

    let cameraRTT, sceneRTT, renderer, zmesh1, zmesh2;

    const previewWidth = 512;
    const previewHeight = 512;

    let rtTexture, material, quad;

    cameraRTT = new THREE.OrthographicCamera(previewWidth / - 2, previewWidth / 2, previewHeight / 2, previewHeight / - 2, - 10000, 10000);
    cameraRTT.position.z = 100;

    //

    sceneRTT = new THREE.Scene();

    let light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 0, 1).normalize();
    sceneRTT.add(light);

    light = new THREE.DirectionalLight(0xffaaaa, 1.5);
    light.position.set(0, 0, - 1).normalize();
    sceneRTT.add(light);

    rtTexture = new THREE.WebGLRenderTarget(previewWidth, previewHeight,
        { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat });

    material = new THREE.MeshLambertMaterial({
        color: '#AA33DD'
    });

    const plane = new THREE.PlaneGeometry(previewWidth, previewHeight);

    quad = new THREE.Mesh(plane, material);
    quad.position.z = - 100;
    sceneRTT.add(quad);

    const torusGeometry = new THREE.TorusGeometry(100, 25, 15, 30);

    const mat1 = new THREE.MeshPhongMaterial({ color: 0x555555, specular: 0xffaa00, shininess: 5 });
    const mat2 = new THREE.MeshPhongMaterial({ color: 0x550000, specular: 0xff2200, shininess: 5 });

    zmesh1 = new THREE.Mesh(torusGeometry, mat1);
    zmesh1.position.set(0, 0, 100);
    zmesh1.scale.set(1.5, 1.5, 1.5);
    sceneRTT.add(zmesh1);

    zmesh2 = new THREE.Mesh(torusGeometry, mat2);
    zmesh2.position.set(0, 150, 100);
    zmesh2.scale.set(0.75, 0.75, 0.75);
    sceneRTT.add(zmesh2);

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(previewWidth, previewHeight);
    renderer.autoClear = false;

    renderer.setRenderTarget( rtTexture );
    renderer.clear();
    renderer.render( sceneRTT, cameraRTT );

    // Extract pixeld
    const buffer = new Uint8Array(previewWidth * previewHeight * 4);
    renderer.readRenderTargetPixels( rtTexture, 0, 0, previewWidth, previewHeight, buffer );

    // encode as png
    const pngbuffer = fastpng.encode({width: previewWidth, height: previewHeight, data: buffer});

    // create blob
    const srcBlob = URL.createObjectURL(new Blob([pngbuffer]));

    return srcBlob;
}