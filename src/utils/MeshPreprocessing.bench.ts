import { bench } from 'vitest';
import fs from 'fs';
import { preprocessMesh, preprocessMeshBase64 } from './MeshPreprocessing';

const file = fs.readFileSync('public/models/telebooth_dengiskong_v2.glb').toString('base64');

bench('benchmark mesh processing array', async () => {
    await preprocessMesh(file, "model/gltf-binary", 256);

    // NOTE: would love to benchmark the worker, but couldn't get it to work.
}, {iterations: 50});

bench('benchmark mesh processing base64', async () => {
    await preprocessMeshBase64(file, "model/gltf-binary", 256);

    // NOTE: would love to benchmark the worker, but couldn't get it to work.
}, {iterations: 50});