import { useEffect, useState } from 'react';
import ReactMarkdown, { uriTransformer } from 'react-markdown'
import { TransformImage } from 'react-markdown/lib/ast-to-react'
import { useParams } from 'react-router-dom';
import Conf from '../../Config';
import { fetchTypedArtPost, TypedArtPost, typedArtPostLink, typedArtUserLink } from './TypedArtUtils';


export const TypedArtBlogPost: React.FC<{}> = (props) => {
    const params = useParams();

    const [id, setId] = useState(parseInt(params.id!));
    const [post, setPost] = useState<TypedArtPost>();

    const ipfsUriTransformer: TransformImage = (
        src: string,
        alt: string,
        title: string | null) => {
        if (src.startsWith('ipfs://'))
            return Conf.randomPublicIpfsGateway() + '/ipfs/' + src.slice(7);
        return uriTransformer(src);
    }

    // Set tag state when prop changes.
    useEffect(() => {
        setId(parseInt(params.id!));
    }, [params.id]);

    // Fetch new posts when tag stage changes.
    useEffect(() => {
        fetchTypedArtPost(id).then((res) => {
            setPost(res);
        });
    }, [id]);

    let postElement: JSX.Element | undefined;

    if (post)
        postElement =
            <div className='mt-3 mb-5' key={post.token_id}>
                <div>
                    <ReactMarkdown transformImageUri={ipfsUriTransformer}>
                        {post.description}
                    </ReactMarkdown>
                </div>
                <div>Post by {typedArtUserLink(post)} - {post.editions} Editions - {typedArtPostLink(post)}</div>
            </div>;

    return (
        <main className="container px-4 py-4">
            {postElement}
        </main>
    );
}