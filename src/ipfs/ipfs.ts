import axios from 'axios';
import * as ipfs from 'ipfs-http-client';
import Conf from '../Config';
//import { GLTFFileLoader } from '@babylonjs/loaders/glTF';
import { Mesh, Nullable, Scene, SceneLoader, TransformNode } from '@babylonjs/core';

const ipfs_client = ipfs.create({ url: Conf.ipfs_url });

export async function download_item(item_id: number, scene: Scene, parent: Nullable<TransformNode>): Promise<Nullable<TransformNode>> {
    // check if we have this item in the scene already.
    // Otherwise, download it.
    var mesh = scene.getMeshByName(`item${item_id}`);
    if(!mesh) {
        const responseP = await axios.get(`${Conf.bcd_url}/v1/tokens/${Conf.tezos_network}/metadata?contract=${Conf.item_contract}&token_id=${item_id}`);
        const artifact = responseP.data[0].artifact_uri;

        // remove ipfs:// from uri
        const hash = artifact.slice(7);

        // LoadAssetContainer?
        const newMeshes = await SceneLoader.ImportMeshAsync('', 'http://localhost:8080/ipfs/', hash, scene, null, '.glb'); // todo: store filetype in metadata!

        // get the root mesh
        mesh = newMeshes.meshes[0] as Mesh;
        mesh.name = `item${item_id}`;

        // then set original to be disabled
        mesh.setEnabled(false);
    }
    //else console.log("mesh found in cache");
        
    // clone
    const instance = mesh.instantiateHierarchy(parent);
    instance?.setEnabled(true);

    //const loader = new GLTFFileLoader();
    //loader.loadFile(null, `http://localhost:8080/ipfs/${hash}`);

    //http://localhost:8080/ipfs/QmbVJzhKrruQx2PVyBKdfhrGFe6aD6aDFMyxoZ8aKHP1UP

    /*const arrayBuffer = await download_file(artifact);
    arrayBuffer.
    const loader = new GLTFFileLoader();
    let file = new File([arrayBuffer.], "Astronaut.glb")
    loader.loadFile()*/

    return instance;
}

export async function download_file(url: string) {
    return ipfs_client.get(url);
}
