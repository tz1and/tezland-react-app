import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { mutezToTez, truncateAddress } from '../../utils/Utils';
import { grapphQLUser } from '../../graphql/user';
import { GetItemHistoryQuery } from '../../graphql/generated/user';
import { DirectoryUtils } from '../../utils/DirectoryUtils';
import TokenKey from '../../utils/TokenKey';


type CollectionHistoryProps = {
    tokenKey: TokenKey;
}

export const CollectionHistory: React.FC<CollectionHistoryProps> = (props) => {
    const [itemHistory, setItemHistory] = useState<GetItemHistoryQuery>();

    useEffect(() => {
        // TODO: need to use fa2
        grapphQLUser.getItemHistory({id: props.tokenKey.id.toNumber(), fa2: props.tokenKey.fa2}).then(res => {
            setItemHistory(res);
        })
    }, [props.tokenKey]);

    const itemHistoryItems: JSX.Element[] = []
    if (itemHistory) itemHistory.itemCollectionHistory.forEach((item) => {
        itemHistoryItems.push(
            <p key={item.transientId}>
                From <Link to={DirectoryUtils.userLink(item.issuerId)}>{truncateAddress(item.issuerId)}</Link> to <Link to={DirectoryUtils.userLink(item.collectorId)}>{truncateAddress(item.collectorId)}</Link> through <Link to={DirectoryUtils.placeLink({id: item.place.tokenId, fa2: item.place.contract.address})}>Place #{item.place.tokenId}</Link> for {mutezToTez(item.rate).toNumber()} {"\uA729"}
            </p>);
    });

    return (
        <div className='mt-2'>
            {itemHistoryItems}
        </div>
    );
}
