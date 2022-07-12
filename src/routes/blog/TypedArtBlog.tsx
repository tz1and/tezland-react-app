import { useEffect, useState } from 'react';
import ReactMarkdown, { uriTransformer } from 'react-markdown'
import { TransformImage } from 'react-markdown/lib/ast-to-react'
import { fetchGraphQL } from '../../ipfs/graphql';
import Conf from '../../Config';


type TypedArtPost = {
    token_id: number;
    description: string;
    minter_address: string;
    editions: number;
    userprofile: {
        user_name: string;
    }
}

type TypedArtBlogProps = {
    tag: "tz1andblog" | "tz1andfeatured";
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
        fetchGraphQL(
            `query getFeaturedPosts($tag: String) {
                tokens(order_by: {token_id: desc}, where: {minter_address: {_eq: "tz1eky73coNLY3e8b3rzBihpkC799Db3UtKp"}, editions: {_gt: 0}, tags: {tag: {_eq: $tag}}}, limit: 10) {
                    token_id
                    description
                    minter_address
                    editions
                    userprofile {
                        user_name
                    }
                }
            }`, 'getFeaturedPosts', { tag: tag }, 'https://api.typed.art/v1/graphql').then((res) => {
                console.log(res);
                setPosts(res.tokens);
            });
    }, [tag]);

    const postElements: JSX.Element[] = [];

    const userLink = (post: TypedArtPost) => {
        if (post.userprofile)
            return <a className="link-secondary" href={"https://typed.art/" + post.userprofile.user_name} target="_blank" rel="noreferrer">{post.userprofile.user_name}</a>
        else
            return <a className="link-secondary" href={"https://typed.art/" + post.minter_address} target="_blank" rel="noreferrer">{post.minter_address}</a>
    }

    const postLink = (post: TypedArtPost) => {
        return <a className="link-secondary" href={"https://typed.art/" + post.token_id} target="_blank" rel="noreferrer">View on typed.art</a>;
    }

    if (posts)
        for (const post of posts) {
            postElements.push(
                <div className='mt-3 mb-5' key={post.token_id}>
                    <div>
                        <ReactMarkdown transformImageUri={ipfsUriTransformer} components={{ h1: 'h2', h2: 'h3', h3: 'h4', h4: 'h5', h5: 'h6', h6: 'h6' }}>
                            {post.description}
                        </ReactMarkdown>
                    </div>
                    <div>Post by {userLink(post)} - {post.editions} Editions - {postLink(post)}</div>
                </div>);
        }

    return (
        <main className="container px-4 py-4">
            <h1 className='mb-6'>{props.tag === "tz1andblog" ? "Blog" : "Featured"}</h1>
            {postElements}
        </main>
    );
}