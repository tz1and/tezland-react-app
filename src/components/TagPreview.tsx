import React from 'react';
import { Badge } from 'react-bootstrap';
import { processTags } from '../ipfs/ipfs';

type TagPreviewProps = {
    tags: string;
};

export const TagPreview: React.FC<TagPreviewProps> = (props) => {
    const processedTags = processTags(props.tags);

    const tags: JSX.Element[] = []
    processedTags.forEach((tag, index) => {
        tags.push(
            <Badge key={index} pill bg="primary" className="me-1">
                {tag}
            </Badge>
        );
    });

    if (tags.length === 0)
        return (null);

    return (
        <div className='mb-3'>{tags}</div>
    );
}
