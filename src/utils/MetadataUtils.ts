import Conf from "../Config";
import missing_thumbnail from '../img/missing_thumbnail.png';

export type RoyaltiesAndSupply = {
    royalties: number;
    supply: number;
}

export namespace MetadataUtils {
    export function getThumbnailUrl(item_metadata: any): string {
        if (item_metadata && item_metadata.thumbnailUri)
            return `${Conf.ipfs_native_gateway}/ipfs/${item_metadata.thumbnailUri.slice(7)}`;

        return missing_thumbnail;
    }

    export function getDescription(item_metadata: any): string {
        return item_metadata && item_metadata.description ? item_metadata.description : "None.";
    }

    export function getName(item_metadata: any): string {
        return item_metadata && item_metadata.name ? item_metadata.name : "";
    }
}