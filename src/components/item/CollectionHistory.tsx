import React from 'react';
import { Link } from 'react-router-dom';
import TezosWalletContext from '../../components/TezosWalletContext';
import { mutezToTez, truncateAddress } from '../../utils/Utils';
import { fetchGraphQL } from '../../ipfs/graphql';
import { getiFrameControl } from '../../forms/DirectoryForm';
import Conf from '../../Config';

type CollectionHistoryProps = {
    tokenId: number;
}

type CollectionHistoryState = {
    itemHistory?: any;
}

export class CollectionHistory extends React.Component<CollectionHistoryProps, CollectionHistoryState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;

    constructor(props: CollectionHistoryProps) {
        super(props);
        this.state = {};
    }

    private async fetchItemHistory(): Promise<any> {
        const data = await fetchGraphQL(`
            query getItemHistory($id: bigint!) {
                itemCollectionHistory(where: {itemTokenId: {_eq: $id}}, order_by: {level: desc}) {
                    id
                    placeId
                    issuerId
                    collectorId
                    mutezPerToken
                }
            }`, "getItemHistory", { id: this.props.tokenId });
        
        return data.itemCollectionHistory;
    }

    private userLink(address: string): string {
        if(getiFrameControl(window))
            return `/directory/u/${address}`;
        else
            return `/u/${address}`;
    }

    override componentDidMount() {
        this.fetchItemHistory().then(res => {
            this.setState({itemHistory: res});
        })
    }

    override render() {
        const itemHistory = this.state.itemHistory;
        const itemHistoryItems: JSX.Element[] = []
        if (itemHistory) itemHistory.forEach((item: any) => {
            if (item.holderId !== Conf.world_contract)
                itemHistoryItems.push(
                    <p key={item.id}>
                        From <Link to={this.userLink(item.issuerId)}>{truncateAddress(item.issuerId)}</Link> to <Link to={this.userLink(item.collectorId)}>{truncateAddress(item.collectorId)}</Link> through Place #{item.placeId} for {mutezToTez(item.mutezPerToken).toNumber()} {"\uA729"}
                    </p>);
        });

        return (
            <div className='mt-2'>
                {itemHistoryItems}
            </div>
        );
    }
}
