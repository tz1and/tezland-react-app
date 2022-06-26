import React from 'react';
import { Badge } from 'react-bootstrap';

type TagPreviewProps = {
    tags: string;
};

export const TagPreview: React.FC<TagPreviewProps> = (props) => {
    const itemTags = props.tags.split(';');

    const tags: JSX.Element[] = []
    if (itemTags) itemTags.forEach((tag, index) => {
        const trimmed = tag.trim();
        if(trimmed.length > 0) 
            tags.push(
                <Badge key={index} pill bg="primary" className="mx-1">
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
