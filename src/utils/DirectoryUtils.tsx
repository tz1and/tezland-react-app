import { getDirectoryEnabledGlobal } from "../forms/DirectoryForm";
import { PlaceKey } from "../world/nodes/BasePlaceNode";
import TokenKey from "./TokenKey";
import { truncateAddress } from "./Utils";

export namespace DirectoryUtils {
    export const userLink = (address: string): string => {
        if(getDirectoryEnabledGlobal())
            return `/directory/u/${address}`;
        else
            return `/u/${address}`;
    }

    export const collectionLink = (fa2: string) => {
        if(getDirectoryEnabledGlobal())
            return `/directory/c/${fa2}`;
        else
            return `/c/${fa2}`;
    }

    export const itemLink = (tokenKey: TokenKey) => {
        if(getDirectoryEnabledGlobal())
            return `/directory/i/${tokenKey.fa2}/${tokenKey.id.toNumber()}`;
        else
            return `/i/${tokenKey.fa2}/${tokenKey.id.toNumber()}`;
    }

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

    export const tzktAccountLink = (account: string): string => {
        return `https://tzkt.io/${account}`;
    }

    export const tzktAccountLinkElement = (account: string): JSX.Element => {
        return <a href={tzktAccountLink(account)} target="_blank">{truncateAddress(account)}</a>;
    }
}