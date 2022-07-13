import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown, { uriTransformer } from 'react-markdown'
import { TransformImage } from 'react-markdown/lib/ast-to-react'
import { Link } from 'react-router-dom';
import Conf from '../../Config';
import { fetchTypedArtPosts, TypedArtPost, typedArtPostLink, TypedArtPostType, typedArtUserLink } from './TypedArtUtils';


type TypedArtBlogProps = {
    tag: TypedArtPostType;
}

export const TypedArtBlog: React.FC<TypedArtBlogProps> = (props) => {
    const [tag, setTag] = useState(props.tag);
    const [posts, setPosts] = useState<TypedArtPost[]>();

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
        setTag(props.tag);
    }, [props.tag]);

    // Fetch new posts when tag stage changes.
    useEffect(() => {
        fetchTypedArtPosts(tag).then((res) => {
            setPosts(res);
        });
    }, [tag]);

    const postElements: JSX.Element[] = [];

    const sahreLink = (post: TypedArtPost) => {
        return <Link className="link-secondary" to={"/blog/" + post.token_id}>Share link</Link>;
    }

    if (posts)
        for (const post of posts) {
            postElements.push(
                <div className='mt-3 mb-5' key={post.token_id}>
                    <hr />
                    <div className="mb-4">Post by {typedArtUserLink(post)} - {post.editions} Editions - {typedArtPostLink(post)} - {sahreLink(post)}</div>
                    <div>
                        <ReactMarkdown transformImageUri={ipfsUriTransformer} components={{
                            //h1: 'h2', h2: 'h3', h3: 'h4', h4: 'h5', h5: 'h6', h6: 'h6',
                            // eslint-disable-next-line jsx-a11y/alt-text
                            img: ({node, ...props}) => <img className="img-fluid" {...props} />}}>
                            {post.description}
                        </ReactMarkdown>
                    </div>
                </div>);
        }

    const title = props.tag === "tz1andblog" ? "Blog" : "Featured";

    return (
        <main className="container px-4 py-4">
            <Helmet>
                <title>tz1and - {title}</title>
            </Helmet>
            <h1 className='mb-6'>{title}</h1>
            {postElements}
        </main>
    );
}