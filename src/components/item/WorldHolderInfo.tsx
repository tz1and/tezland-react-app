import React, { useEffect, useState } from 'react';
import { mutezToTez } from '../../utils/TezosUtils';
import Conf from '../../Config';
import { grapphQLUser } from '../../graphql/user';
import { GetItemHolderInfoQuery, GetItemWorldInfoQuery } from '../../graphql/generated/user';
import { DirectoryUtils } from '../../utils/DirectoryUtils';
import TokenKey from '../../utils/TokenKey';
import PlaceKey from '../../utils/PlaceKey';


type WorldHolderInfoProps = {
    tokenKey: TokenKey;
    onlySwaps?: boolean;
    targetBlank?: boolean;
}

export const WorldHolderInfo: React.FC<WorldHolderInfoProps> = (props) => {

    const [holderInfo, setHolderInfo] = useState<GetItemHolderInfoQuery>();
    const [worldInfo, setWorldInfo] = useState<GetItemWorldInfoQuery>();

    useEffect(() => {
        if (!props.onlySwaps)
            grapphQLUser.getItemHolderInfo({id: props.tokenKey.id.toNumber(), fa2: props.tokenKey.fa2}).then(res => {
                setHolderInfo(res);
            });
    }, [props.tokenKey, props.onlySwaps]);

    useEffect(() => {
        grapphQLUser.getItemWorldInfo({id: props.tokenKey.id.toNumber(), fa2: props.tokenKey.fa2}).then(res => {
            setWorldInfo(res);
        });

    }, [props.tokenKey]);

    const holderInfoItems: JSX.Element[] = []
    if (holderInfo) holderInfo.itemTokenHolder.forEach((item) => {
        if (item.holderId !== Conf.world_contract)
            holderInfoItems.push(<p key={item.holderId}>{item.quantity}x {DirectoryUtils.userLinkElement(item.holderId, props.targetBlank)}</p>);
    });

    const placeLink = (item: GetItemWorldInfoQuery['worldItemPlacement'][number]) => {
        return DirectoryUtils.placeLinkElement(new PlaceKey(item.place.tokenId, item.place.contractId), props.targetBlank);
    }

    const price = (item: GetItemWorldInfoQuery['worldItemPlacement'][number]) => {
        if (item.rate > 0) return <span>for {mutezToTez(item.rate).toNumber()} {"\uA729"}</span>;
        return null;
    }

    const worldInfoItems: JSX.Element[] = []
    if (worldInfo) worldInfo.worldItemPlacement.forEach((item) => {
        if (!props.onlySwaps || (props.onlySwaps && item.rate > 0))
            worldInfoItems.push(
                item.issuerId ?
                    <p key={item.transientId}>
                        {item.amount}x by {DirectoryUtils.userLinkElement(item.issuerId, props.targetBlank)} in {placeLink(item)} {price(item)}
                    </p> :
                    <p key={item.transientId}>
                        {item.amount}x in {placeLink(item)} {price(item)}
                    </p>);
    });

    return (
        <div className='mt-2'>
            {worldInfoItems}
            {holderInfoItems}
        </div>
    );
}
