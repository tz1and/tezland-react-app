import React from 'react';
import { Link } from 'react-router-dom';
import TezosWalletContext from '../../components/TezosWalletContext';
import { getiFrameControl } from '../../forms/DirectoryForm';
import { grapphQLUser } from '../../graphql/user';
import { GetItemTagsQuery } from '../../graphql/generated/user';
import { Badge } from 'react-bootstrap';

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

    private tagLink(tag: string): string {
        if(getiFrameControl(window))
            return `/directory/t/${tag}`;
        else
            return `/t/${tag}`;
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
                <Link key={tag.name} to={this.tagLink(tag.name)}>
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
