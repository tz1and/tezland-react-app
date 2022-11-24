import { getDirectoryEnabledGlobal } from "../forms/DirectoryForm";
import { PlaceKey } from "../world/nodes/BasePlaceNode";
import TokenKey from "./TokenKey";

export namespace DirectoryUtils {
    export const userLink = (address: string): string => {
        if(getDirectoryEnabledGlobal())
            return `/directory/u/${address}`;
        else
            return `/u/${address}`;
    }

    // TODO: should link to fa2/tokenid
    export const itemLink = (tokenKey: TokenKey) => {
        if(getDirectoryEnabledGlobal())
            return `/directory/i/${tokenKey.fa2}/${tokenKey.id.toNumber()}`;
        else
            return `/i/${tokenKey.fa2}/${tokenKey.id.toNumber()}`;
    }

    // TODO: should link to fa2/tokenid
    export const placeLink = (placeKey: PlaceKey) => {
        if(getDirectoryEnabledGlobal())
            return `/directory/p/${placeKey.fa2}/${placeKey.id}`;
        else
            return `/p/${placeKey.fa2}/${placeKey.id}`;
    }

    export const tagLink = (tag: string): string => {
        if(getDirectoryEnabledGlobal())
            return `/directory/t/${encodeURIComponent(tag)}`;
        else
            return `/t/${encodeURIComponent(tag)}`;
    }
}