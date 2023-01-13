import { AssetContainer } from "@babylonjs/core/assetContainer";
import { StandardMaterial } from "@babylonjs/core/Materials";
import { Texture } from "@babylonjs/core/Materials/Textures";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh, TransformNode } from "@babylonjs/core/Meshes";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
import { Logging } from "./Logging";


function loadTextureAsync(file: File, scene: Scene): Promise<Texture> {
    return new Promise((resolve, reject) => {
        const tex = Texture.LoadFromDataString(file.name, file, scene,
            undefined, // deleteBuffer
            undefined, // noMipmapOrOptions
            undefined, // invertY
            undefined, // samplingMode
            undefined, // onLoad
            (err) => { // onError
                Logging.Error(err);
                reject(err);
            });
        tex.onLoadObservable.addOnce((texture) => {
            resolve(texture);
        })
    });
}

function frameMaker(name: string, options: {path: Vector3[], profile: Vector3[]}, scene: Scene) {	
    const path = options.path;
    const profile = options.profile;
    
    let originX = Number.MAX_VALUE;
    
    for(let m = 0; m < profile.length; m++) {
        originX = Math.min(originX, profile[m].x);
    }

    let angle = 0;
    let width = 0;
    const cornerProfile: Vector3[][] = [];
    
    const nbPoints = path.length;
    let line = Vector3.Zero();
    const nextLine = Vector3.Zero();
    path[1].subtractToRef(path[0], line);
    path[2].subtractToRef(path[1], nextLine);    
    
    for(let p = 0; p < nbPoints; p++) {    
        angle = Math.PI - Math.acos(Vector3.Dot(line, nextLine)/(line.length() * nextLine.length()));            
        const direction = Vector3.Cross(line, nextLine).normalize().z;                
        const lineNormal = new Vector3(line.y, -1 * line.x, 0).normalize();
        line.normalize();
        cornerProfile[(p + 1) % nbPoints] = [];
        //local profile
        for(let m = 0; m < profile.length; m++) {
            width = profile[m].x - originX;
            cornerProfile[(p + 1) % nbPoints].push(path[(p + 1) % nbPoints].subtract(lineNormal.scale(width)).subtract(line.scale(direction * width/Math.tan(angle/2))));			
        }   
        
        line = nextLine.clone();        
        path[(p + 3) % nbPoints].subtractToRef(path[(p + 2) % nbPoints], nextLine);    
    }
    
    const frame: Mesh[] = [];
    let extrusionPaths: Vector3[][] = []
    
    for(let p = 0; p < nbPoints; p++) {
        extrusionPaths = [];
        for(let m = 0; m < profile.length; m++) {
            extrusionPaths[m] = [];
            extrusionPaths[m].push(new Vector3(cornerProfile[p][m].x, cornerProfile[p][m].y, profile[m].y));
            extrusionPaths[m].push(new Vector3(cornerProfile[(p + 1) % nbPoints][m].x, cornerProfile[(p + 1) % nbPoints][m].y, profile[m].y));
        }

        frame[p] = MeshBuilder.CreateRibbon("frameLeft", {pathArray: extrusionPaths, sideOrientation: Mesh.BACKSIDE, updatable: true, closeArray: true}, scene);
    }

    const mergedMesh = Mesh.MergeMeshes(frame, true);
    if (!mergedMesh) throw new Error("Merged mesh empty");

    mergedMesh.name = name;
    return mergedMesh.convertToFlatShadedMesh();
}

export function createFrameForImage(file: File, dim: {width: number, height: number}, scene: Scene, assetContainer: Nullable<AssetContainer>) {
    scene._blockEntityCollection = !!assetContainer;

    const tex = Texture.LoadFromDataString(file.name, file, scene);
    tex._parentContainer = assetContainer;

    const mat = new StandardMaterial("image_mat", scene);
    mat.diffuseTexture = tex;
    mat.indexOfRefraction = 1.5;
    mat.emissiveColor = new Color3(0.7, 0.7, 0.7);
    //mat.directIntensity = 2;
    mat.roughness = 0.8;
    mat._parentContainer = assetContainer;

    const image = MeshBuilder.CreatePlane("image", { width: dim.width, height: dim.height, sideOrientation: Mesh.FRONTSIDE }, scene);
    image.material = mat;
    image._parentContainer = assetContainer;

    const frameMat = new StandardMaterial("frame_mat", scene);
    // TODO: Needs to be a var in metadata?
    frameMat.diffuseColor = new Color3(0.06, 0.04, 0.02);
    frameMat.indexOfRefraction = 1.4;
    frameMat.roughness = 0.2;
    frameMat._parentContainer = assetContainer;

    const backMat = new StandardMaterial("back_mat", scene);
    // TODO: Needs to be a var in metadata?
    backMat.diffuseColor = new Color3(0.35, 0.2, 0.1).scale(1.3);
    backMat.indexOfRefraction = 1.0;
    backMat.roughness = 1;
    backMat._parentContainer = assetContainer;

    const back = MeshBuilder.CreatePlane("back", { width: dim.width, height: dim.height, sideOrientation: Mesh.BACKSIDE }, scene);
    back.material = backMat;
    back._parentContainer = assetContainer;

    // TODO: Needs to be a var in metadata?
    const frameSize = Math.max(dim.width, dim.height) / 50;
    const frameSizeB = frameSize / 3 * 2;

    // Frame path needs to account for frame size.
    const w_half = dim.width * 0.5 + frameSize * 2;
    const h_half = dim.height * 0.5 + frameSize * 2;

    const path = [
        new Vector3(-w_half, -h_half, 0),
        new Vector3(w_half, -h_half, 0),
        new Vector3(w_half, h_half, 0),
        new Vector3(-w_half, h_half, 0)
    ];

    // TODO: Profile may need to be a var in metadata?
    //profile in XoY plane, the left most point(s) will form the outer edge of the frame along the given path.
    const profilePoints = [
        new Vector3(-frameSize, frameSize, 0),
        new Vector3(-frameSize, -frameSize, 0),
        //new Vector3(frameSizeB, -frameSize, 0),
        new Vector3(frameSize, -frameSizeB, 0),
        new Vector3(frameSize, frameSize, 0),
    ];

    const frame = frameMaker("line", {path: path, profile:profilePoints}, scene);
    frame.material = frameMat;
    frame._parentContainer = assetContainer;

    // TODO: frame and image need to be offset somehow.

    const parent = new TransformNode("parent", scene);
    parent._parentContainer = assetContainer;

    image.parent = parent;
    image.position.z -= frameSize;
    frame.parent = parent;
    frame.position.z -= frameSize;
    back.parent = parent;
    back.position.z -= frameSize * 0.5;

    scene._blockEntityCollection = false;

    if (assetContainer) {
        // Add to AssetContainer.
        assetContainer.meshes.push(...parent.getChildMeshes());
        assetContainer.transformNodes.push(parent);
        assetContainer.rootNodes.push(parent);

        for (const mesh of assetContainer.meshes) {
            if (mesh.material) {
                assetContainer.materials.push(mesh.material);
                assetContainer.textures.push(...mesh.material.getActiveTextures())
            }
        }
    }

    return parent;
}