import { getDirectoryEnabledGlobal } from "../forms/DirectoryForm";

export namespace DirectoryUtils {
    export const userLink = (address: string): string => {
        if(getDirectoryEnabledGlobal())
            return `/directory/u/${address}`;
        else
            return `/u/${address}`;
    }

    export const itemLink = (tokenId: number) => {
        if(getDirectoryEnabledGlobal())
            return `/directory/i/${tokenId}`;
        else
            return `/i/${tokenId}`;
    }

    export const placeLink = (tokenId: number) => {
        if(getDirectoryEnabledGlobal())
            return `/directory/p/${tokenId}`;
        else
            return `/p/${tokenId}`;
    }

    export const tagLink = (tag: string): string => {
        if(getDirectoryEnabledGlobal())
            return `/directory/t/${encodeURIComponent(tag)}`;
        else
            return `/t/${encodeURIComponent(tag)}`;
    }
}