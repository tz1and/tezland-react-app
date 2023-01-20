import assert from "assert";
import { decode, DecodedPng } from "fast-png";
import Conf from "../Config";
import { FrameParams } from "../utils/FrameImage";
import { dataURItoBlob, fileToFileLike, getFileType, isImageFileType } from "../utils/Utils";
import { createItemTokenMetadata } from '../ipfs/ipfs';


namespace MintFormUtils {
    export interface MintFormValues {
        collection: string;
        itemTitle: string;
        itemDescription: string;
        itemTags: string;
        itemAmount: number;
        itemRoyalties: [string, number][];
        frameRatio: number;
        frameColor: string;
        itemFile?: File | undefined;
    }

    export const ThumbnailImageRes = 350;
    export const DisplayImageRes = 1000;

    // TODO: use createImageBitmap?
    function checkImageValid(image: DecodedPng, w: number, h: number, title: string) {
        // check channels.
        if (image.channels < 3) throw new Error(`Invalid ${title} image: num channels < 3`);

        // check resolution.
        if (image.width !== w) throw new Error(`Invalid ${title} image: wrong width`);
        if (image.height !== h) throw new Error(`Invalid ${title} image: wrong height`);

        // Check most pixels aren't 0!
        let zero_count = 0;
        for (let i = 0; i < image.data.length; ++i) {
            if(image.data[i] === 0) ++zero_count;
        }
        if (zero_count > image.data.length / 3) throw new Error(`Invalid ${title} image: data mostly empty`);
    }

    /**
     * Takes form values and returns token metadata.
     * @param values form values
     * @param minter address of the minter
     * @param polycount the polygon count, must be >= 0
     * @param mintDate the mint date
     * @param thumbnail thumbnail image, as dataUri
     * @param display display image, as dataUri
     * @param frameParams the frame parameters, if any
     * @returns Token metadata as string
     */
    export async function formValuesToItemTokenMetadata(values: MintFormValues, minter: string, polycount: number,
        mintDate: Date, thumbnail: string, display: string, frameParams?: FrameParams): Promise<string>
    {
        assert(polycount >= 0, "Polycount is negative");
        assert(values.itemFile, "No file set in form");

        // Get thumbnail and check it's valid.
        const decoded_thumbnail = decode(await dataURItoBlob(thumbnail).arrayBuffer());
        checkImageValid(decoded_thumbnail, ThumbnailImageRes, ThumbnailImageRes, "thumbnail");

        // Get display and check it's valid.
        const decoded_display = decode(await dataURItoBlob(display).arrayBuffer());
        checkImageValid(decoded_display, DisplayImageRes, DisplayImageRes, "display");

        // TODO: validate mimeType in validation.
        let mime_type;
        const file_type = await getFileType(values.itemFile);
        // TODO: have a getMimeType
        if(file_type === "glb") mime_type = "model/gltf-binary";
        else if(file_type === "gltf") mime_type = "model/gltf+json";
        else if(file_type === "png") mime_type = "image/png";
        else if(file_type === "jpg" || file_type === "jpeg") mime_type = "image/jpeg";
        else throw new Error("Unsupported mimeType");

        const metadata_royalties = new Map<string, number>();
        // Metadata royalties are in permille.
        for (const [k, v] of values.itemRoyalties) metadata_royalties.set(k, Math.floor(v * 10));
        if(metadata_royalties.size > 0) metadata_royalties.set(Conf.fees_address, 35);

        const isImage = isImageFileType(mime_type);

        let imageDimenstions;
        if (isImage) {
            assert(frameParams !== undefined, "Image must have frameParams");

            // TODO: get this from model preview. pass image dimensions back to mint form.
            // also the image frame settings? no, they probably need to be passed *into* model preview.
            const res = await createImageBitmap(values.itemFile);
            imageDimenstions = {
                value: res.width + "x" + res.height,
                unit: "px"
            }
            res.close();
        }

        // TODO: add frame parameters!
        const metadata = createItemTokenMetadata({
            name: values.itemTitle,
            description: values.itemDescription,
            date: mintDate,
            minter: minter,
            artifactUri: await fileToFileLike(values.itemFile, mime_type),
            displayUri: { dataUri: display, type: "image/png", name: "display.png" },
            thumbnailUri: { dataUri: thumbnail, type: "image/png", name: "thumbnail.png" },
            tags: values.itemTags,
            formats: [
                {
                    uri: { topLevelRef: "artifactUri" },
                    mimeType: mime_type,
                    fileSize: values.itemFile.size,
                    fileName: values.itemFile.name,
                    dimensions: imageDimenstions
                },
                {
                    uri: { topLevelRef: "displayUri" },
                    mimeType: "image/png",
                    fileName: "display.png",
                    dimensions: {
                        value: DisplayImageRes + "x" + DisplayImageRes,
                        unit: "px"
                    }
                },
                {
                    uri: { topLevelRef: "thumbnailUri" },
                    mimeType: "image/png",
                    fileName: "thumbnail.png",
                    dimensions: {
                        value: ThumbnailImageRes + "x" + ThumbnailImageRes,
                        unit: "px"
                    }
                }
            ],
            baseScale: 1,
            polygonCount: polycount,
            royalties: {
                decimals: 3,
                shares: metadata_royalties
            },
            imageFrame: isImage ? frameParams : undefined
        });

        return metadata;
    }
}

export default MintFormUtils;