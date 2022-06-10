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
    var pickInfo = ray.intersectsMesh(mesh);
    while (pickInfo.hit) {
        hitCount++;
        pickInfo.pickedPoint!.addToRef(direction.scale(0.00000001), refPoint);
        ray.origin = refPoint;
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

export type RefLike = {
  topLevelRef: string
}

export const fileToFileLike = (file: File, mimeType?: string): Promise<FileLike> => {
  return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = function () {
          resolve({ dataUri: reader.result as string, type: (mimeType ? mimeType : file.type), name: file.name });
      };
  });
};

export const truncate = (str: string, n: number, ellip?: string) => {
  return (str.length > n) ? str.substring(0, n-1) + (ellip ? ellip :'&hellip;') : str;
};

export const truncateAddress = (address: string) => {
  if(address.length > 13) {
    return address.substring(0, 8) + '\u2026' + address.substring(address.length-5, address.length);
  }

  return address;
}

export const truncateOperationHash = (opHash: string) => {
  if(opHash.length > 12) {
    return opHash.substring(0, 7) + '\u2026' + opHash.substring(opHash.length-5, opHash.length);
  }

  return opHash;
}

export const sleep = (milliseconds: number) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
};

// Tries to get the file type from the file header, otherwise
// returns extension.
export const getFileType = async (file: File): Promise<string> => {
  const fbuf = await file.arrayBuffer();
  const view = new DataView(fbuf);

  // Check various (supported) file headers.
  if(view.getUint32(0) === 1735152710) return 'glb';

  // Otherwise, decide by file extension.
  return getFileExt(file.name);
}

export const getFileExt = (filename: string) => {
  return filename.substring(filename.lastIndexOf('.') + 1);
}

export const signedArea = (data: number[], start: number, end: number, dim: number) => {
  var sum = 0;
  for (var i = start, j = end - dim; i < end; i += dim) {
      sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
      j = i;
  }
  return sum / 2;
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

export const yesNo = (v: boolean): string => {
  return v ? "Yes" : "No";
}

export const isEpsilonEqual = (a: number, b: number, epsilon: number = Number.EPSILON) => {
  return (Math.abs(a - b) < epsilon);
}

// Triggers download of a data url as a file.
export const downloadFile = (data_url: string, filename: string) => {
  // create download file link
  const link = document.createElement('a');
  link.href = data_url;
  link.setAttribute(
    'download',
    filename,
  );

  // Append to html link element and cick it
  document.body.appendChild(link);
  link.click();

  // Clean up and remove the link
  document.body.removeChild(link);
}

export const scrollbarVisible = (element: HTMLElement) => {
  return element.scrollHeight > element.clientHeight;
}

export const numberWithSign = (n: number): string => { return (n > 0) ? "+" + n : n.toString(); };