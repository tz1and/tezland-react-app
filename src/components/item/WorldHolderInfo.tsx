import React from 'react';
import { Link } from 'react-router-dom';
import TezosWalletContext from '../../components/TezosWalletContext';
import { mutezToTez, truncateAddress } from '../../utils/Utils';
import { fetchGraphQL } from '../../ipfs/graphql';
import { getiFrameControl } from '../../forms/DirectoryForm';
import Conf from '../../Config';

type WorldHolderInfoProps = {
    tokenId: number;
}

type WorldHolderInfoState = {
    holderInfo?: any;
    worldInfo?: any;
}

export class WorldHolderInfo extends React.Component<WorldHolderInfoProps, WorldHolderInfoState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;

    constructor(props: WorldHolderInfoProps) {
        super(props);
        this.state = {};
    }

    private async fetchWorldInfo(): Promise<any> {
        const data = await fetchGraphQL(`
            query getWorldInfo($id: bigint!) {
                worldItemPlacement(where: {itemTokenId: {_eq: $id}}, order_by: {mutezPerToken: desc}) {
                    id
                    placeId
                    itemId
                    issuerId
                    tokenAmount
                    mutezPerToken
                }
            }`, "getWorldInfo", { id: this.props.tokenId });
        
        return data.worldItemPlacement;
    }

    private async fetchHolderInfo(): Promise<any> {
        const data = await fetchGraphQL(`
            query getHolderInfo($id: bigint!) {
                itemTokenHolder(where: {tokenId: {_eq: $id}}, order_by: {quantity: desc}) {
                    holderId
                    quantity
                }
            }`, "getHolderInfo", { id: this.props.tokenId });
        
        return data.itemTokenHolder;
    }

    private userLink(address: string): string {
        if(getiFrameControl(window))
            return `/directory/u/${address}`;
        else
            return `/u/${address}`;
    }

    override componentDidMount() {
        this.fetchHolderInfo().then(res => {
            this.setState({holderInfo: res});
        });

        this.fetchWorldInfo().then(res => {
            this.setState({worldInfo: res});
        });
    }

    override render() {
        const holderInfo = this.state.holderInfo;
        const holderInfoItems: JSX.Element[] = []
        if (holderInfo) holderInfo.forEach((item: any) => {
            if (item.holderId !== Conf.world_contract)
                holderInfoItems.push(<p key={item.holderId}>{item.quantity}x <Link to={this.userLink(item.holderId)}>{truncateAddress(item.holderId)}</Link></p>);
        });

        const worldInfo = this.state.worldInfo;
        const worldInfoItems: JSX.Element[] = []
        if (worldInfo) worldInfo.forEach((item: any) => {
            if (item.holderId !== Conf.world_contract)
                worldInfoItems.push(
                    <p key={item.id}>
                        {item.tokenAmount}x <Link to={this.userLink(item.issuerId)}>{truncateAddress(item.issuerId)}</Link> in Place #{item.placeId} {item.mutezPerToken > 0 && <span>for {mutezToTez(item.mutezPerToken).toNumber()} {"\uA729"}</span>}
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
