import { bench } from 'vitest';
import fs from 'fs';
import { preprocessMesh } from './MeshPreprocessing';

const file = fs.readFileSync('public/models/telebooth_dengiskong_v2.glb')
const fileBase64 = file.toString('base64');

bench('benchmark mesh processing array', async () => {
    await preprocessMesh(file, "model/gltf-binary", 256);

    // NOTE: would love to benchmark the worker, but couldn't get it to work.
}, {iterations: 50});

/*bench('benchmark mesh processing base64', async () => {
    await preprocessMeshBase64(fileBase64, "model/gltf-binary", 256);

    // NOTE: would love to benchmark the worker, but couldn't get it to work.
}, {iterations: 50});*/