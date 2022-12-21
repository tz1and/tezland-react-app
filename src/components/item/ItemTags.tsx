import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { grapphQLUser } from '../../graphql/user';
import { GetItemTagsQuery } from '../../graphql/generated/user';
import { Badge } from 'react-bootstrap';
import { DirectoryUtils } from '../../utils/DirectoryUtils';
import TokenKey from '../../utils/TokenKey';


type ItemTagsProps = {
    tokenKey: TokenKey;
    clickable?: boolean;
    targetBlank?: boolean;
}

export const ItemTags: React.FC<ItemTagsProps> = (props) => {
    const [itemTags, setItemTags] = useState<GetItemTagsQuery>();

    useEffect(() => {
        // TODO: needs FA2
        grapphQLUser.getItemTags({id: props.tokenKey.id.toNumber(), fa2: props.tokenKey.fa2}).then(res => {
            setItemTags(res);
        })
    }, [props.tokenKey])

    const extraProps = props.targetBlank ? {
        target: "_blank", rel: "noopener noreferrer"
    } : {}

    const tags: JSX.Element[] = []
    if (itemTags) itemTags.tag.forEach((tag) => {
        tags.push(
            props.clickable ?
                <Link key={tag.name} {...extraProps} to={DirectoryUtils.tagLink(tag.name)}>
                    <Badge pill bg="primary" className="me-1">
                        {tag.name}
                    </Badge>
                </Link> :
                <Badge key={tag.name} pill bg="primary" className="me-1">
                    {tag.name}
                </Badge>
        );
    });

    return (
        <div>
            {tags}
        </div>
    );
}
