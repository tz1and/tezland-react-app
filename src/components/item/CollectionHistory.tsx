import React from 'react';
import { Link } from 'react-router-dom';
import TezosWalletContext from '../../components/TezosWalletContext';
import { mutezToTez, truncateAddress } from '../../utils/Utils';
import { getiFrameControl } from '../../forms/DirectoryForm';
import { grapphQLUser } from '../../graphql/user';
import { GetItemHistoryQuery } from '../../graphql/generated/user';

type CollectionHistoryProps = {
    tokenId: number;
}

type CollectionHistoryState = {
    itemHistory?: GetItemHistoryQuery;
}

export class CollectionHistory extends React.Component<CollectionHistoryProps, CollectionHistoryState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;

    constructor(props: CollectionHistoryProps) {
        super(props);
        this.state = {};
    }

    private userLink(address: string): string {
        if(getiFrameControl(window))
            return `/directory/u/${address}`;
        else
            return `/u/${address}`;
    }

    override componentDidMount() {
        grapphQLUser.getItemHistory({id: this.props.tokenId}).then(res => {
            this.setState({itemHistory: res});
        })
    }

    override render() {
        const itemHistory = this.state.itemHistory;
        const itemHistoryItems: JSX.Element[] = []
        if (itemHistory) itemHistory.itemCollectionHistory.forEach((item) => {
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
