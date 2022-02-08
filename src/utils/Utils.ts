import { AbstractMesh, Axis, Mesh, Ray, Vector3 } from "@babylonjs/core";
import BigNumber from 'bignumber.js';


export const pointIsInside = (point: Vector3, mesh: Mesh) => {
    const boundInfo = mesh.getBoundingInfo();
    if(!boundInfo.intersectsPoint(point))
        return false;

    const diameter = 2 * boundInfo.boundingSphere.radius;

    var pointFound = false;
    var hitCount = 0;
    const ray = new Ray(Vector3.Zero(), Axis.X, diameter);
    const direction = point.clone();
    const refPoint = point.clone();

    hitCount = 0;
    ray.origin = refPoint;
    ray.direction = direction;
    ray.length = diameter;
    // @ts-expect-error
    var pickInfo = ray.intersectsMesh(mesh);
    while (pickInfo.hit) {
        hitCount++;
        pickInfo.pickedPoint!.addToRef(direction.scale(0.00000001), refPoint);
        ray.origin = refPoint;
        // @ts-expect-error
        pickInfo = ray.intersectsMesh(mesh);
    }   
    if((hitCount % 2) === 1) {
        pointFound = true;
    }
    
    return pointFound;
}

export const isDev = () => !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

export const toHexString = (bytes: Uint8Array) => bytes.reduce((str: String, byte: Number) => str + byte.toString(16).padStart(2, '0'), '');

export const fromHexString = (hexString: string) => new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

export function readFileAsync(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };

    reader.onerror = reject;

    reader.readAsArrayBuffer(file);
  })
}

export const tokensAmountToNat = (tokensAmount: BigNumber | number, decimals: number): BigNumber => {
  return new BigNumber(tokensAmount).multipliedBy(10 ** decimals).integerValue();
};

export const numberToTokensAmount = (value: BigNumber | number, decimals: number): BigNumber => {
  return new BigNumber(value).div(10 ** decimals);
};

const tezDecimals = 6;
export const tezToMutez = (tez: BigNumber | number): BigNumber => tokensAmountToNat(tez, tezDecimals);
export const mutezToTez = (mutez: BigNumber | number): BigNumber => numberToTokensAmount(mutez, tezDecimals);

export const dataURItoBlob = (dataURI: string): Blob => {
  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

  var buf = Buffer.from(dataURI.split(',')[1], 'base64')

  // write the ArrayBuffer to a blob, and you're done
  var blob = new Blob([buf], {type: mimeString});
  return blob;
}

export type FileLike = {
  dataUri: string,
  type: string,
  name: string
}

export const fileToFileLike = (file: File): Promise<FileLike> => {
  return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = function () {
          resolve({ dataUri: reader.result as string, type: file.type, name: file.name });
      };
  });
};

export const truncate = (str: string, n: number, ellip?: string) => {
  return (str.length > n) ? str.substring(0, n-1) + (ellip ? ellip :'&hellip;') : str;
};

export const sleep = (milliseconds: number) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
};

export const getFileExt = (filename: string) => {
  return filename.substring(filename.lastIndexOf('.') + 1);
}

export const signedArea = (data: number[], start: number, end: number, dim: number) => {
  var sum = 0;
  for (var i = start, j = end - dim; i < end; i += dim) {
      sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
      j = i;
  }
  return sum;
}

export const countPolygons = (meshes: AbstractMesh[]): number => {
  let polycount = 0;
  for(const m of meshes) {
      m.updateFacetData();
      polycount += m.facetNb;
      m.disableFacetData();
  }
  return polycount;
}

export const getUrlFileSizeHead = async (url: string): Promise<number> => {
  const response = await fetch(url, { method: 'HEAD'});

  const contentLength = response.headers.get("content-length");
  if(contentLength)
    return parseInt(contentLength);

  throw new Error("content-length not in response");
}