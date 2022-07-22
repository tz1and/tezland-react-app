import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { mutezToTez, truncateAddress } from '../../utils/Utils';
import { grapphQLUser } from '../../graphql/user';
import { GetItemHistoryQuery } from '../../graphql/generated/user';
import { DirectoryUtils } from '../../utils/DirectoryUtils';


type CollectionHistoryProps = {
    tokenId: number;
}

export const CollectionHistory: React.FC<CollectionHistoryProps> = (props) => {
    const [itemHistory, setItemHistory] = useState<GetItemHistoryQuery>();

    useEffect(() => {
        grapphQLUser.getItemHistory({id: props.tokenId}).then(res => {
            setItemHistory(res);
        })
    }, [props.tokenId]);

    const itemHistoryItems: JSX.Element[] = []
    if (itemHistory) itemHistory.itemCollectionHistory.forEach((item) => {
        itemHistoryItems.push(
            <p key={item.transientId}>
                From <Link to={DirectoryUtils.userLink(item.issuerId)}>{truncateAddress(item.issuerId)}</Link> to <Link to={DirectoryUtils.userLink(item.collectorId)}>{truncateAddress(item.collectorId)}</Link> through <Link to={DirectoryUtils.placeLink(item.place.tokenId)}>Place #{item.place.tokenId}</Link> for {mutezToTez(item.mutezPerToken).toNumber()} {"\uA729"}
            </p>);
    });

    return (
        <div className='mt-2'>
            {itemHistoryItems}
        </div>
    );
}
