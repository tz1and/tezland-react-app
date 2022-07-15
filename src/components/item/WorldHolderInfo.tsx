import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { mutezToTez, truncateAddress } from '../../utils/Utils';
import Conf from '../../Config';
import { grapphQLUser } from '../../graphql/user';
import { GetItemHolderInfoQuery, GetItemWorldInfoQuery } from '../../graphql/generated/user';
import { DirectoryUtils } from '../../utils/DirectoryUtils';


type WorldHolderInfoProps = {
    tokenId: number;
    onlySwaps?: boolean;
    targetBlank?: boolean;
}

export const WorldHolderInfo: React.FC<WorldHolderInfoProps> = (props) => {

    const [holderInfo, setHolderInfo] = useState<GetItemHolderInfoQuery>();
    const [worldInfo, setWorldInfo] = useState<GetItemWorldInfoQuery>();

    useEffect(() => {
        if (!props.onlySwaps)
            grapphQLUser.getItemHolderInfo({id: props.tokenId}).then(res => {
                setHolderInfo(res);
            });
    }, [props.tokenId, props.onlySwaps]);

    useEffect(() => {
        grapphQLUser.getItemWorldInfo({id: props.tokenId}).then(res => {
            setWorldInfo(res);
        });

    }, [props.tokenId]);

    const holderInfoItems: JSX.Element[] = []
    if (holderInfo) holderInfo.itemTokenHolder.forEach((item: any) => {
        if (item.holderId !== Conf.world_contract)
            holderInfoItems.push(<p key={item.holderId}>{item.quantity}x <Link to={DirectoryUtils.userLink(item.holderId)}>{truncateAddress(item.holderId)}</Link></p>);
    });

    const extraProps = props.targetBlank ? {
        target: "_blank", rel: "noopener noreferrer"
    } : {}

    const worldInfoItems: JSX.Element[] = []
    if (worldInfo) worldInfo.worldItemPlacement.forEach((item: any) => {
        if (!props.onlySwaps || (props.onlySwaps && item.mutezPerToken > 0))
            worldInfoItems.push(
                <p key={item.id}>
                    {item.tokenAmount}x <Link {...extraProps} to={DirectoryUtils.userLink(item.issuerId)}>{truncateAddress(item.issuerId)}</Link> in <Link {...extraProps} to={DirectoryUtils.placeLink(item.placeId)}>Place #{item.placeId}</Link> {item.mutezPerToken > 0 && <span>for {mutezToTez(item.mutezPerToken).toNumber()} {"\uA729"}</span>}
                </p>);
    });

    return (
        <div className='mt-2'>
            {worldInfoItems}
            {holderInfoItems}
        </div>
    );
}
