import React from 'react';
import { Link } from 'react-router-dom';
import TezosWalletContext from '../../components/TezosWalletContext';
import { mutezToTez, truncateAddress } from '../../utils/Utils';
import Conf from '../../Config';
import { grapphQLUser } from '../../graphql/user';
import { GetItemHolderInfoQuery, GetItemWorldInfoQuery } from '../../graphql/generated/user';
import { DirectoryUtils } from '../../utils/DirectoryUtils';

type WorldHolderInfoProps = {
    tokenId: number;
}

type WorldHolderInfoState = {
    holderInfo?: GetItemHolderInfoQuery;
    worldInfo?: GetItemWorldInfoQuery;
}

export class WorldHolderInfo extends React.Component<WorldHolderInfoProps, WorldHolderInfoState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;

    constructor(props: WorldHolderInfoProps) {
        super(props);
        this.state = {};
    }

    override componentDidMount() {
        grapphQLUser.getItemHolderInfo({id: this.props.tokenId}).then(res => {
            this.setState({holderInfo: res});
        });

        grapphQLUser.getItemWorldInfo({id: this.props.tokenId}).then(res => {
            this.setState({worldInfo: res});
        });
    }

    override render() {
        const holderInfo = this.state.holderInfo;
        const holderInfoItems: JSX.Element[] = []
        if (holderInfo) holderInfo.itemTokenHolder.forEach((item: any) => {
            if (item.holderId !== Conf.world_contract)
                holderInfoItems.push(<p key={item.holderId}>{item.quantity}x <Link to={DirectoryUtils.userLink(item.holderId)}>{truncateAddress(item.holderId)}</Link></p>);
        });

        const worldInfo = this.state.worldInfo;
        const worldInfoItems: JSX.Element[] = []
        if (worldInfo) worldInfo.worldItemPlacement.forEach((item: any) => {
            worldInfoItems.push(
                <p key={item.id}>
                    {item.tokenAmount}x <Link to={DirectoryUtils.userLink(item.issuerId)}>{truncateAddress(item.issuerId)}</Link> in Place #{item.placeId} {item.mutezPerToken > 0 && <span>for {mutezToTez(item.mutezPerToken).toNumber()} {"\uA729"}</span>}
                </p>);
        });

        return (
            <div className='mt-2'>
                {worldInfoItems}
                {holderInfoItems}
            </div>
        );
    }
}
