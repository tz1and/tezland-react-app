import assert from 'assert';
import { Logging } from '../../utils/Logging';
import BASIS from './basis_encoder';


let BasisFile: any = null;
let BasisEncoder: any = null;

const BASIS_INITIALIZED: Promise<any> = BASIS(/*{ wasmBinary: basisWasmSource }*/).then((module: any) => {
    BasisFile = module.BasisFile;
    BasisEncoder = module.BasisEncoder;
    module.initializeBasis();
});

// Copied from enum class transcoder_texture_format in basisu_transcoder.h with minor javascript-ification
const BASIS_FORMAT = {
    // Compressed formats

    // ETC1-2
    cTFETC1_RGB: 0,							// Opaque only, returns RGB or alpha data if cDecodeFlagsTranscodeAlphaDataToOpaqueFormats flag is specified
    cTFETC2_RGBA: 1,							// Opaque+alpha, ETC2_EAC_A8 block followed by a ETC1 block, alpha channel will be opaque for opaque .basis files

    // BC1-5, BC7 (desktop, some mobile devices)
    cTFBC1_RGB: 2,							// Opaque only, no punchthrough alpha support yet, transcodes alpha slice if cDecodeFlagsTranscodeAlphaDataToOpaqueFormats flag is specified
    cTFBC3_RGBA: 3, 							// Opaque+alpha, BC4 followed by a BC1 block, alpha channel will be opaque for opaque .basis files
    cTFBC4_R: 4,								// Red only, alpha slice is transcoded to output if cDecodeFlagsTranscodeAlphaDataToOpaqueFormats flag is specified
    cTFBC5_RG: 5,								// XY: Two BC4 blocks, X=R and Y=Alpha, .basis file should have alpha data (if not Y will be all 255's)
    cTFBC7_RGBA: 6,							// RGB or RGBA, mode 5 for ETC1S, modes (1,2,3,5,6,7) for UASTC

    // PVRTC1 4bpp (mobile, PowerVR devices)
    cTFPVRTC1_4_RGB: 8,						// Opaque only, RGB or alpha if cDecodeFlagsTranscodeAlphaDataToOpaqueFormats flag is specified, nearly lowest quality of any texture format.
    cTFPVRTC1_4_RGBA: 9,					// Opaque+alpha, most useful for simple opacity maps. If .basis file doesn't have alpha cTFPVRTC1_4_RGB will be used instead. Lowest quality of any supported texture format.

    // ASTC (mobile, Intel devices, hopefully all desktop GPU's one day)
    cTFASTC_4x4_RGBA: 10,					// Opaque+alpha, ASTC 4x4, alpha channel will be opaque for opaque .basis files. Transcoder uses RGB/RGBA/L/LA modes, void extent, and up to two ([0,47] and [0,255]) endpoint precisions.

    // Uncompressed (raw pixel) formats
    cTFRGBA32: 13,							// 32bpp RGBA image stored in raster (not block) order in memory, R is first byte, A is last byte.
    cTFRGB565: 14,							// 166pp RGB image stored in raster (not block) order in memory, R at bit position 11
    cTFBGR565: 15,							// 16bpp RGB image stored in raster (not block) order in memory, R at bit position 0
    cTFRGBA4444: 16,							// 16bpp RGBA image stored in raster (not block) order in memory, R at bit position 12, A at bit position 0

    cTFTotalTextureFormats: 22,
};

// WebGL compressed formats types, from:
// http://www.khronos.org/registry/webgl/extensions/

// https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_s3tc/
const COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83F0;
const COMPRESSED_RGBA_S3TC_DXT1_EXT = 0x83F1;
const COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83F2;
const COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83F3;

// https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_etc1/
const COMPRESSED_RGB_ETC1_WEBGL = 0x8D64;

// https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_etc/
const COMPRESSED_R11_EAC = 0x9270;
const COMPRESSED_SIGNED_R11_EAC = 0x9271;
const COMPRESSED_RG11_EAC = 0x9272;
const COMPRESSED_SIGNED_RG11_EAC = 0x9273;
const COMPRESSED_RGB8_ETC2 = 0x9274;
const COMPRESSED_SRGB8_ETC2 = 0x9275;
const COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2 = 0x9276;
const COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2 = 0x9277;
const COMPRESSED_RGBA8_ETC2_EAC = 0x9278;
const COMPRESSED_SRGB8_ALPHA8_ETC2_EAC = 0x9279;

// https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_astc/
const COMPRESSED_RGBA_ASTC_4x4_KHR = 0x93B0;

// https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_pvrtc/
const COMPRESSED_RGB_PVRTC_4BPPV1_IMG = 0x8C00;
const COMPRESSED_RGB_PVRTC_2BPPV1_IMG = 0x8C01;
const COMPRESSED_RGBA_PVRTC_4BPPV1_IMG = 0x8C02;
const COMPRESSED_RGBA_PVRTC_2BPPV1_IMG = 0x8C03;

// https://www.khronos.org/registry/webgl/extensions/EXT_texture_compression_bptc/
const COMPRESSED_RGBA_BPTC_UNORM_EXT = 0x8E8C;
const COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT = 0x8E8D;
const COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT = 0x8E8E;
const COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT = 0x8E8F;

const BASIS_WEBGL_FORMAT_MAP: any = {};
// Compressed formats
BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.cTFBC1_RGB] = { format: COMPRESSED_RGB_S3TC_DXT1_EXT };
BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.cTFBC3_RGBA] = { format: COMPRESSED_RGBA_S3TC_DXT5_EXT };
BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.cTFBC7_RGBA] = { format: COMPRESSED_RGBA_BPTC_UNORM_EXT };
BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.cTFETC1_RGB] = { format: COMPRESSED_RGB_ETC1_WEBGL };
BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.cTFETC2_RGBA] = { format: COMPRESSED_RGBA8_ETC2_EAC };
BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.cTFASTC_4x4_RGBA] = { format: COMPRESSED_RGBA_ASTC_4x4_KHR };
BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.cTFPVRTC1_4_RGB] = { format: COMPRESSED_RGB_PVRTC_4BPPV1_IMG };
BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.cTFPVRTC1_4_RGBA] = { format: COMPRESSED_RGBA_PVRTC_4BPPV1_IMG };

// Uncompressed formats
BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.cTFRGBA32] = { uncompressed: true, format: WebGLRenderingContext.RGBA, type: WebGLRenderingContext.UNSIGNED_BYTE };
BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.cTFRGB565] = { uncompressed: true, format: WebGLRenderingContext.RGB, type: WebGLRenderingContext.UNSIGNED_SHORT_5_6_5 };
BASIS_WEBGL_FORMAT_MAP[BASIS_FORMAT.cTFRGBA4444] = { uncompressed: true, format: WebGLRenderingContext.RGBA, type: WebGLRenderingContext.UNSIGNED_SHORT_4_4_4_4 };

function basisFileFail(basisFile: any, errorMsg: string) {
    basisFile.close();
    basisFile.delete();
    throw new Error(errorMsg);
}

// This utility currently only transcodes the first image in the file.
const IMAGE_INDEX = 0;
const TOP_LEVEL_MIP = 0;

export function encodeWrapper(arrayBuffer: Uint8Array) {
    return new Promise<Uint8Array>((resolve, reject) => {
        if (BasisFile) {
            resolve(encode(arrayBuffer));
        } else {
            BASIS_INITIALIZED.then(() => {
                resolve(encode(arrayBuffer));
            });
        }
    });
}

function encode(arrayBuffer: Uint8Array) {
    // Create a destination buffer to hold the compressed .basis file data. If this buffer isn't large enough compression will fail.
    const basisFileData = new Uint8Array(Math.max(1024*1024*10, arrayBuffer.length * 2));

    let num_output_bytes;

    // Compress using the BasisEncoder class.
    Logging.InfoDev('BasisEncoder::encode() started:');

    const basisEncoder = new BasisEncoder();

    const qualityLevel = 10;
    const uastcFlag = true; // uastc is hight quality but slower. can be used for normal maps.

    basisEncoder.setSliceSourceImage(0, new Uint8Array(arrayBuffer), 0, 0, true);
    basisEncoder.setCreateKTX2File(true); // ktx2 is the standard format.
    //basisEncoder.setCheckForAlpha(true); // todo: figure out alpha issues
    //basisEncoder.setForceAlpha(true);
    basisEncoder.setDebug(false);
    basisEncoder.setComputeStats(false);
    basisEncoder.setPerceptual(true); // sRGB?
    basisEncoder.setMipSRGB(true); // sRGB?
    basisEncoder.setQualityLevel(qualityLevel);
    basisEncoder.setUASTC(uastcFlag);
    basisEncoder.setMipGen(true); // generate mip maps?

    if (!uastcFlag)
        Logging.InfoDev('Encoding at ETC1S quality level ' + qualityLevel);

    const startTime = performance.now();

    num_output_bytes = basisEncoder.encode(basisFileData);

    const elapsed = performance.now() - startTime;

    Logging.InfoDev('encoding time', elapsed.toFixed(2));

    const actualBasisFileData = new Uint8Array(basisFileData.buffer, 0, num_output_bytes);

    basisEncoder.delete();

    if (num_output_bytes === 0) {
        throw new Error('encodeBasisTexture() failed!');
    }
    else {
        Logging.InfoDev('encodeBasisTexture() succeeded, output size ' + num_output_bytes);

        return actualBasisFileData;
    }
}

export function transcodeWrapper(arrayBuffer: Uint8Array, supportedFormats: any, allowSeparateAlpha: boolean = false) {
    return new Promise<Uint8Array>((resolve, reject) => {
        if (BasisFile) {
            Logging.InfoDev("has basis file");
            resolve(transcode(arrayBuffer, supportedFormats, allowSeparateAlpha));
        } else {
            Logging.InfoDev("not yet initialised");
            BASIS_INITIALIZED.then(() => {
                resolve(transcode(arrayBuffer, supportedFormats, allowSeparateAlpha));
            });
        }
    });
}

function transcode(arrayBuffer: Uint8Array, supportedFormats: any, allowSeparateAlpha: boolean = false) {
    assert(allowSeparateAlpha === false, "Separate alpha not allowed");

    let basisFile = new BasisFile(arrayBuffer);
    Logging.InfoDev(basisFile);
    let images = basisFile.getNumImages();
    let levels = basisFile.getNumLevels(IMAGE_INDEX);
    let hasAlpha = basisFile.getHasAlpha();
    Logging.InfoDev(images, levels, hasAlpha);
    if (!images || !levels) {
        basisFileFail(basisFile, 'Invalid Basis data');
    }

    if (!basisFile.startTranscoding()) {
        basisFileFail(basisFile, 'startTranscoding failed');
    }

    let basisFormat = undefined;
    let needsSecondaryAlpha = false;
    if (hasAlpha) {
        if (supportedFormats.etc2) {
            basisFormat = BASIS_FORMAT.cTFETC2_RGBA;
        } else if (supportedFormats.bptc) {
            basisFormat = BASIS_FORMAT.cTFBC7_RGBA;
        } else if (supportedFormats.s3tc) {
            basisFormat = BASIS_FORMAT.cTFBC3_RGBA;
        } else if (supportedFormats.astc) {
            basisFormat = BASIS_FORMAT.cTFASTC_4x4_RGBA;
        } else if (supportedFormats.pvrtc) {
            if (allowSeparateAlpha) {
                basisFormat = BASIS_FORMAT.cTFPVRTC1_4_RGB;
                needsSecondaryAlpha = true;
            } else {
                basisFormat = BASIS_FORMAT.cTFPVRTC1_4_RGBA;
            }
        } else if (supportedFormats.etc1 && allowSeparateAlpha) {
            basisFormat = BASIS_FORMAT.cTFETC1_RGB;
            needsSecondaryAlpha = true;
        } else {
            // If we don't support any appropriate compressed formats transcode to
            // raw pixels. This is something of a last resort, because the GPU
            // upload will be significantly slower and take a lot more memory, but
            // at least it prevents you from needing to store a fallback JPG/PNG and
            // the download size will still likely be smaller.
            //basisFormat = BASIS_FORMAT.RGBA32; // TODO!!!!
            assert(false, "No supported transcode formats");
        }
    } else {
        if (supportedFormats.etc1) {
            // Should be the highest quality, so use when available.
            // http://richg42.blogspot.com/2018/05/basis-universal-gpu-texture-format.html
            basisFormat = BASIS_FORMAT.cTFETC1_RGB;
        } else if (supportedFormats.bptc) {
            basisFormat = BASIS_FORMAT.cTFBC7_RGBA;
        } else if (supportedFormats.s3tc) {
            basisFormat = BASIS_FORMAT.cTFBC1_RGB;
        } else if (supportedFormats.etc2) {
            basisFormat = BASIS_FORMAT.cTFETC2_RGBA;
        } else if (supportedFormats.astc) {
            basisFormat = BASIS_FORMAT.cTFASTC_4x4_RGBA;
        } else if (supportedFormats.pvrtc) {
            basisFormat = BASIS_FORMAT.cTFPVRTC1_4_RGB;
        } else {
            // See note on uncompressed transcode above.
            basisFormat = BASIS_FORMAT.cTFRGB565;
        }
    }

    if (basisFormat === undefined) {
        basisFileFail(basisFile, 'No supported transcode formats');
    }

    let webglFormat = BASIS_WEBGL_FORMAT_MAP[basisFormat];

    // If we're not using compressed textures it'll be cheaper to generate
    // mipmaps on the fly, so only transcode a single level.
    if (webglFormat.uncompressed) {
        levels = 1;
    }

    // Gather information about each mip level to be transcoded.
    let mipLevels = [];
    let totalTranscodeSize = 0;

    for (let mipLevel = 0; mipLevel < levels; ++mipLevel) {
        let transcodeSize = basisFile.getImageTranscodedSizeInBytes(IMAGE_INDEX, mipLevel, basisFormat);
        mipLevels.push({
            level: mipLevel,
            offset: totalTranscodeSize,
            size: transcodeSize,
            width: basisFile.getImageWidth(IMAGE_INDEX, mipLevel),
            height: basisFile.getImageHeight(IMAGE_INDEX, mipLevel),
        });
        totalTranscodeSize += transcodeSize;
    }

    // Allocate a buffer large enough to hold all of the transcoded mip levels at once.
    let transcodeData = new Uint8Array(totalTranscodeSize);
    let alphaTranscodeData = needsSecondaryAlpha ? new Uint8Array(totalTranscodeSize) : null;

    // Transcode each mip level into the appropriate section of the overall buffer.
    for (let mipLevel of mipLevels) {
        let levelData = new Uint8Array(transcodeData.buffer, mipLevel.offset, mipLevel.size);
        if (!basisFile.transcodeImage(levelData, IMAGE_INDEX, mipLevel.level, basisFormat, 1, 0)) {
            basisFileFail(basisFile, 'transcodeImage failed');
        }
        if (needsSecondaryAlpha) {
            let alphaLevelData = new Uint8Array(alphaTranscodeData!.buffer, mipLevel.offset, mipLevel.size);
            if (!basisFile.transcodeImage(alphaLevelData, IMAGE_INDEX, mipLevel.level, basisFormat, 1, 1)) {
                basisFileFail(basisFile, 'alpha transcodeImage failed');
            }
        }
    }

    basisFile.close();
    basisFile.delete();

    return transcodeData;
}

/*onmessage = (msg) => {
    // Each call to the worker must contain:
    let url = msg.data.url; // The URL of the basis image OR
    let buffer = msg.data.buffer; // An array buffer with the basis image data
    let allowSeparateAlpha = msg.data.allowSeparateAlpha;
    let supportedFormats = msg.data.supportedFormats; // The formats this device supports
    let id = msg.data.id; // A unique ID for the texture

    if (url) {
        // Make the call to fetch the basis texture data
        fetch(url).then(function (response) {
            if (response.ok) {
                response.arrayBuffer().then((arrayBuffer) => {
                    if (BasisFile) {
                        transcode(id, arrayBuffer, supportedFormats, allowSeparateAlpha);
                    } else {
                        BASIS_INITIALIZED.then(() => {
                            transcode(id, arrayBuffer, supportedFormats, allowSeparateAlpha);
                        });
                    }
                });
            } else {
                fail(id, `Fetch failed: ${response.status}, ${response.statusText}`);
            }
        });
    } else if (buffer) {
        if (BasisFile) {
            transcode(id, buffer, supportedFormats, allowSeparateAlpha);
        } else {
            BASIS_INITIALIZED.then(() => {
                transcode(id, buffer, supportedFormats, allowSeparateAlpha);
            });
        }
    } else {
        fail(id, `No url or buffer specified`);
    }
};*/