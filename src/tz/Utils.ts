import { Axis, Mesh, Ray, Vector3 } from "@babylonjs/core";
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
    // @ts-ignore
    var pickInfo = ray.intersectsMesh(mesh);
    while (pickInfo.hit) {
        hitCount++;
        pickInfo.pickedPoint!.addToRef(direction.scale(0.00000001), refPoint);
        ray.origin = refPoint;
        // @ts-ignore
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
  // TODO: this is pretty inefficient. rewrite sometime, maybe.
  // convert base64 to raw binary data held in a string
  var byteString = atob(dataURI.split(',')[1]);

  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);

  // create a view into the buffer
  var ia = new Uint8Array(ab);

  // set the bytes of the buffer to the correct values
  for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  var blob = new Blob([ab], {type: mimeString});
  return blob;
}

export const truncate = (str: string, n: number, ellip?: string) => {
  return (str.length > n) ? str.substring(0, n-1) + (ellip ? ellip :'&hellip;') : str;
};

export const sleep = (milliseconds: number) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
};