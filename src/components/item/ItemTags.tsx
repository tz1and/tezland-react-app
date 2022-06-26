import React from 'react';
import { Link } from 'react-router-dom';
import TezosWalletContext from '../../components/TezosWalletContext';
import { grapphQLUser } from '../../graphql/user';
import { GetItemTagsQuery } from '../../graphql/generated/user';
import { Badge } from 'react-bootstrap';
import { DirectoryUtils } from '../../utils/DirectoryUtils';

type ItemTagsProps = {
    tokenId: number;
}

type ItemTagsState = {
    itemTags?: GetItemTagsQuery;
}

export class ItemTags extends React.Component<ItemTagsProps, ItemTagsState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;

    constructor(props: ItemTagsProps) {
        super(props);
        this.state = {};
    }

    override componentDidMount() {
        grapphQLUser.getItemTags({id: this.props.tokenId}).then(res => {
            this.setState({itemTags: res});
        })
    }

    override render() {
        const itemTags = this.state.itemTags;
        const tags: JSX.Element[] = []
        if (itemTags) itemTags.tag.forEach((tag) => {
            tags.push(
                <Link key={tag.name} to={DirectoryUtils.tagLink(tag.name)}>
                    <Badge pill bg="primary" className="mx-1">
                        {tag.name}
                    </Badge>
                </Link>
            );
        });

        return (
            <div>
                {tags}
            </div>
        );
    }
}
