import { PBRMaterial } from "@babylonjs/core/Materials/PBR";
import { Texture } from "@babylonjs/core/Materials/Textures";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh, TransformNode } from "@babylonjs/core/Meshes";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
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
        
        // TODO: don't use double sdie
        frame[p] = MeshBuilder.CreateRibbon("frameLeft", {pathArray: extrusionPaths, sideOrientation: Mesh.BACKSIDE, updatable: true, closeArray: true}, scene);
    }

    const mergedMesh = Mesh.MergeMeshes(frame, true);
    if (!mergedMesh) throw new Error("Merged mesh empty");

    mergedMesh.name = name;
    return mergedMesh.convertToFlatShadedMesh();
}

export async function createFrameForImage(file: File, scene: Scene) {
    const mat = new PBRMaterial("image_mat", scene);
    const tex = await loadTextureAsync(file, scene);
    mat.albedoTexture = tex;
    mat.metallic = 0.1;
    //mat.directIntensity = 2;
    mat.roughness = 0.8;

    const size = tex.getSize();
    const image = MeshBuilder.CreatePlane("image", { width: size.width, height: size.height, sideOrientation: Mesh.FRONTSIDE }, scene);
    image.material = mat;

    const frameMat = new PBRMaterial("frame_mat", scene);
    // TODO: Needs to be a var in metadata?
    frameMat.albedoColor = new Color3(0.03, 0.02, 0.01);
    frameMat.metallic = 0.4;
    frameMat.roughness = 0.2;

    const backMat = new PBRMaterial("back_mat", scene);
    // TODO: Needs to be a var in metadata?
    backMat.albedoColor = new Color3(0.2, 0.1, 0.05);
    backMat.metallic = 0.0;
    backMat.roughness = 1;

    const back = MeshBuilder.CreatePlane("back", { width: size.width, height: size.height, sideOrientation: Mesh.BACKSIDE }, scene);
    back.material = backMat;

    // TODO: Needs to be a var in metadata?
    const frameSize = Math.max(size.width, size.height) / 50;
    const frameSizeB = frameSize / 3 * 2;

    // Frame path needs to account for frame size.
    const w_half = size.width * 0.5 + frameSize * 2;
    const h_half = size.height * 0.5 + frameSize * 2;

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

    // TODO: frame and image need to be offset somehow.

    const parent = new TransformNode("parent", scene);
    image.parent = parent;
    image.position.z += frameSize;
    frame.parent = parent;
    frame.position.z += frameSize;
    back.parent = parent;
    back.position.z += frameSize + frameSize * 0.5;

    return parent;
}