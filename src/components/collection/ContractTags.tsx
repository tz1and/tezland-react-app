import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { grapphQLUser } from '../../graphql/user';
import { GetCollectionTagsQuery } from '../../graphql/generated/user';
import { Badge } from 'react-bootstrap';
import { DirectoryUtils } from '../../utils/DirectoryUtils';


type CollectionTagsProps = {
    address: string;
    clickable?: boolean;
    targetBlank?: boolean;
}

export const CollectionTags: React.FC<CollectionTagsProps> = (props) => {
    const [collectionTags, setCollectionTags] = useState<GetCollectionTagsQuery>();

    useEffect(() => {
        // TODO: needs FA2
        grapphQLUser.getCollectionTags({fa2: props.address}).then(res => {
            setCollectionTags(res);
        })
    }, [props.address])

    const extraProps = props.targetBlank ? {
        target: "_blank", rel: "noopener noreferrer"
    } : {}

    const tags: JSX.Element[] = []
    if (collectionTags) collectionTags.tag.forEach((tag) => {
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
