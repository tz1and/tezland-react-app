// NOTE: using isDev or inDev will stop webpack from stripping this code
// If that is desired either use:
// if (import.meta.env.DEV) ...
// No, that's not a joke.
export const isDev = () => import.meta.env.DEV;

export const inDev = <T>(func: () => T): T | undefined => {
  if (import.meta.env.DEV) return func();
  return undefined;
}

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
  return (str.length > n) ? str.substring(0, n-1).trimEnd() + (ellip ? ellip :'&hellip;') : str;
};

export const sleep = (milliseconds: number) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
};

// Tries to get the file type from the file header, otherwise
// returns extension.
// TODO: rename to getFileExt
export const getFileType = async (file: File): Promise<string> => {
  const fbuf = await file.arrayBuffer();
  const view = new DataView(fbuf);

  // Check various (supported) file headers.
  if(view.getUint32(0) === 1735152710) return 'glb';

  // Otherwise, decide by file extension.
  return getFileExt(file.name);
}

export const isImageFile = (ext: string) => {
  if (ext === "jpg") return true;
  if (ext === "jpeg") return true;
  if (ext === "png") return true;
  return false;
}

export const isImageFileType = (mime_type: string) => {
  if (mime_type === "image/jpeg") return true;
  if (mime_type === "image/png") return true;
  return false;
}

export const getFileExt = (filename: string) => {
  return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
}

export const signedArea = (data: number[], start: number, end: number, dim: number) => {
  var sum = 0;
  for (var i = start, j = end - dim; i < end; i += dim) {
      sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
      j = i;
  }
  return sum / 2;
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
