import Conf from "../Config";
import missing_thumbnail from '../img/missing_thumbnail.png';
import { ItemTokenMetadata } from "../world/Metadata";

export type RoyaltiesAndSupply = {
    royalties: number;
    supply: number;
}

export namespace MetadataUtils {
    //NOTE: use for both FetchDataItemMetadata, and ItemTokenMetadata.
    export function getThumbnailUrl(item_metadata: any): string {
        if (item_metadata && item_metadata.thumbnailUri)
            return `${Conf.ipfs_native_gateway}/ipfs/${item_metadata.thumbnailUri.slice(7)}`;

        return missing_thumbnail;
    }

    export function getDescription(item_metadata: ItemTokenMetadata | undefined): string {
        return item_metadata && item_metadata.description ? item_metadata.description : "None.";
    }

    export function getName(item_metadata: ItemTokenMetadata | undefined): string {
        return item_metadata && item_metadata.name ? item_metadata.name : "";
    }
}