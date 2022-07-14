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
    onlySwaps?: boolean;
    targetBlank?: boolean;
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
        if (!this.props.onlySwaps)
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

        const extraProps = this.props.targetBlank ? {
            target: "_blank", rel: "noopener noreferrer"
        } : {}

        const worldInfo = this.state.worldInfo;
        const worldInfoItems: JSX.Element[] = []
        if (worldInfo) worldInfo.worldItemPlacement.forEach((item: any) => {
            if (!this.props.onlySwaps || (this.props.onlySwaps && item.mutezPerToken > 0))
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
}
