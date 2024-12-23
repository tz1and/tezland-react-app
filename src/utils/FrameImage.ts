import { AssetContainer } from "@babylonjs/core/assetContainer";
import { StandardMaterial } from "@babylonjs/core/Materials";
import { Texture } from "@babylonjs/core/Materials/Textures";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh, TransformNode } from "@babylonjs/core/Meshes";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";


export type FrameParams = {
    version: number;
    imageMat: {
        indexOfRefraction: number;
        emissiveColor: [number, number, number];
        roughness: number;
    };
    frameMat: {
        diffuseColor: [number, number, number];
        indexOfRefraction: number;
        roughness: number;
    };
    backMat: {
        diffuseColor: [number, number, number];
        indexOfRefraction: number;
        roughness: number;
    };
    frame: {
        // Size of the frame in relation to the image.
        // frameSize = `Math.max(img.width, img.height) * frame.frameRatio;`
        frameRatio: number;
        // The frame profile, in the XY plane, scaled by frameSize.
        // Values -1 and 1 are the "edge" of the frame, values can exceed those limits, but probably shouldn't.
        // Winding order matters (because backfaces).
        profile: [number, number][];
        // Offset of image and back panel.
        // Relative to frameSize, 0 = center. -1 and 1 = outer edge.
        frontOffset: number;
        backOffset: number;
    }
}

export const defaultFrameParams: FrameParams = {
    version: 1,
    imageMat: {
        indexOfRefraction: 1.5,
        emissiveColor: [0.7, 0.7, 0.7],
        roughness: 0.3
    },
    frameMat: {
        diffuseColor: [0.4, 0.35, 0.4],
        indexOfRefraction: 1.4,
        roughness: 0.8
    },
    backMat: {
        diffuseColor: [0.455, 0.26, 0.13],
        indexOfRefraction: 1.0,
        roughness: 1.0
    },
    frame: {
        frameRatio: 0.02,
        profile: [
            [-1.05, 1.05],
            [-1.05, -1.05],
            //[2/3, -1.05],
            [1.05, -2/3],
            [1.05, 1.05],
        ],
        frontOffset: 0.2,
        backOffset: -0.8
    }
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

export function createFrameForImage(file: File, dim: {width: number, height: number}, frameParams: FrameParams, scene: Scene, assetContainer: Nullable<AssetContainer>) {
    scene._blockEntityCollection = !!assetContainer;

    const tex = Texture.LoadFromDataString(file.name, file, scene);
    tex._parentContainer = assetContainer;

    const mat = new StandardMaterial("image_mat", scene);
    mat.diffuseTexture = tex;
    mat.indexOfRefraction = frameParams.imageMat.indexOfRefraction;
    mat.emissiveColor = Color3.FromArray(frameParams.imageMat.emissiveColor);
    //mat.directIntensity = 2;
    mat.roughness = frameParams.imageMat.roughness;
    mat._parentContainer = assetContainer;

    const image = MeshBuilder.CreatePlane("image", { width: dim.width, height: dim.height, sideOrientation: Mesh.FRONTSIDE }, scene);
    image.material = mat;
    image._parentContainer = assetContainer;

    const frameMat = new StandardMaterial("frame_mat", scene);
    // TODO: Needs to be a var in metadata?
    frameMat.diffuseColor = Color3.FromArray(frameParams.frameMat.diffuseColor);
    frameMat.indexOfRefraction = frameParams.frameMat.indexOfRefraction;
    frameMat.roughness = frameParams.frameMat.roughness;
    frameMat._parentContainer = assetContainer;

    const backMat = new StandardMaterial("back_mat", scene);
    // TODO: Needs to be a var in metadata?
    backMat.diffuseColor = Color3.FromArray(frameParams.backMat.diffuseColor)
    backMat.indexOfRefraction = frameParams.backMat.indexOfRefraction;
    backMat.roughness = frameParams.backMat.roughness;
    backMat._parentContainer = assetContainer;

    const back = MeshBuilder.CreatePlane("back", { width: dim.width, height: dim.height, sideOrientation: Mesh.BACKSIDE }, scene);
    back.material = backMat;
    back._parentContainer = assetContainer;

    // TODO: Needs to be a var in metadata?
    const frameSize = Math.max(dim.width, dim.height) * frameParams.frame.frameRatio;

    // Frame path needs to account for frame size.
    const w_half = dim.width * 0.5 + frameSize * 2;
    const h_half = dim.height * 0.5 + frameSize * 2;

    const path = [
        new Vector3(-w_half, -h_half, 0),
        new Vector3(w_half, -h_half, 0),
        new Vector3(w_half, h_half, 0),
        new Vector3(-w_half, h_half, 0)
    ];

    // profile in XoY plane, the left most point(s) will form the outer edge of the frame along the given path.
    const profilePoints: Vector3[] = [];
    for (const tup of frameParams.frame.profile) {
        profilePoints.push(new Vector3(tup[0] * frameSize, tup[1] * frameSize, 0))
    }

    const frame = frameMaker("frame", {path: path, profile:profilePoints}, scene);
    frame.material = frameMat;
    frame._parentContainer = assetContainer;

    // TODO: frame and image need to be offset somehow.

    const parent = new TransformNode("parent", scene);
    parent._parentContainer = assetContainer;

    image.parent = parent;
    image.position.z -= frameSize + (frameSize * frameParams.frame.frontOffset);
    frame.parent = parent;
    frame.position.z -= frameSize;
    back.parent = parent;
    back.position.z -= frameSize + (frameSize * frameParams.frame.backOffset);

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