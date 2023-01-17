import React, { Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import Auctions from './routes/Auctions';
import { CreateAuctionFormW } from './forms/CreateAuction';
//import ComingSoon from './routes/ComingSoon';
import SiteLayout from './routes/SiteLayout';
import DirectoryLayout from './layouts/DirectoryLayout';
import { DirectoryFooterPadding } from './components/DirectoryFooterPadding';
import Frontpage from './routes/Frontpage';
import Faq from './routes/Faq';
import Docs from './routes/Docs';
import Terms from './routes/Terms';
import Privacy from './routes/Privacy';
import Map from './routes/Map';
import EventMap from './routes/EventMap';
import DirectoryMap from './routes/DirectoryMap';
import VirtualSpace from './components/VirtualSpace';
import MintFormWrapper from './forms/MintFormWrapper';
import MintCollectionFormWrapper from './forms/MintCollectionFormWrapper';
import PageNotFound from './routes/PageNotFound';
import { TezosWalletProvider } from './components/TezosWalletContext'
import User from './routes/directory/User';
import Item from './routes/directory/Item';
import { Tag } from './routes/directory/Tag';
import { PlacePage } from './routes/directory/PlacePage';
import { Search } from './routes/directory/Search';
import { NewMints } from './routes/directory/NewMints';
import { NewSwaps } from './routes/directory/NewSwaps';
import { Collection } from './routes/directory/Collection';
import { TypedArtBlog } from './routes/blog/TypedArtBlog';
import { TypedArtBlogPost } from './routes/blog/TypedArtBlogPost';
import { TypedArtPostType } from './routes/blog/TypedArtUtils';
import EnterDirectory from './routes/EnterDirectory';
import Tools from './routes/Tools';
import Loading from './components/util/Loading';
import Conf from './Config';


const Acknowledgements = React.lazy(() => import('./routes/Acknowledgements'));

const RedirectToV1Item: React.FC<{directoryEnabled: boolean}> = (props) => {
    const params = useParams();
    return <Navigate replace to={`${props.directoryEnabled ? '/directory' : ''}/i/${Conf.item_v1_contract}/${params.id!}`} />
}

const RedirectToV2Place: React.FC<{directoryEnabled: boolean}> = (props) => {
    const params = useParams();
    return <Navigate replace to={`${props.directoryEnabled ? '/directory' : ''}/p/${Conf.place_contract}/${params.id!}`} />
}

function AppRouter(props: React.PropsWithChildren<{}>) {
    const [directoryEnabled, setDirectoryEnabled] = useState(false);

    const directoryRoutes = <>
        <Route path="search" element={<Search />} />
        <Route path="event/:eventTag/:eventLabel" element={<EventMap />} />

        <Route path="u/:address" element={<User />} />
        <Route path="i/:fa2/:id" element={<Item />} />
        <Route path="c/:fa2" element={<Collection />} />
        <Route path="p/:fa2/:id" element={<PlacePage />} />
        <Route path="t/:tag" element={<Tag />} />

        {/* Also handle old routes to places and items. */}
        <Route path="i/:id" element={<RedirectToV1Item directoryEnabled={directoryEnabled} />} />
        <Route path="p/:id" element={<RedirectToV2Place directoryEnabled={directoryEnabled} />} />

        <Route path="new">
            <Route path="mints" element={<NewMints />} />
            <Route path="swaps" element={<NewSwaps />} />
        </Route>
    </>;

    let devRoutes;
    if (import.meta.env.DEV) {
        const GenerateMap = React.lazy(() => import('./routes/GenerateMap'));
        devRoutes = <Route path="genmap" element={<Suspense fallback={<Loading />}><GenerateMap /></Suspense>} />;
    }

    return (
        <TezosWalletProvider>
            <BrowserRouter>
                {props.children}
                <Routes>
                    {!directoryEnabled ?
                        <Route path="/" element={<SiteLayout />}>
                            <Route path="" element={<Frontpage />} />

                            <Route path="mint">
                                <Route path="item" element={<MintFormWrapper />}/>
                                <Route path="collection" element={<MintCollectionFormWrapper />}/>
                            </Route>

                            <Route path="auctions">
                                <Route path="" element={<Auctions />} />
                                <Route path="create" element={<CreateAuctionFormW />} />
                            </Route>
                            <Route path="map" element={<Map />} />

                            <Route path="docs" element={<Docs />} />
                            <Route path="faq" element={<Faq />} />
                            <Route path="tools" element={<Tools />} />
                            <Route path="privacy" element={<Privacy />} />
                            <Route path="terms" element={<Terms />} />
                            <Route path="acknowledgements" element={<Suspense fallback={<Loading />}><Acknowledgements /></Suspense>} />

                            <Route path="blog">
                                <Route path="" element={<TypedArtBlog tag={TypedArtPostType.Blog} />} />
                                <Route path=":id" element={<TypedArtBlogPost />} />
                                <Route path="featured" element={<TypedArtBlog tag={TypedArtPostType.Featured} />} />
                            </Route>

                            {directoryRoutes}
                            {devRoutes}

                            <Route path="*" element={<PageNotFound />} />

                            <Route path="directory/*" element={<EnterDirectory setDirectoryEnabled={setDirectoryEnabled} />} />
                        </Route> :
                        <Route path="/directory" element={<DirectoryLayout />}>
                            <Route path="map" element={<DirectoryMap />} />

                            <Route element={<DirectoryFooterPadding />}>
                                {directoryRoutes}

                                <Route path="*" element={<PageNotFound />} />
                            </Route>
                        </Route> }
                    <Route path="/explore" element={<VirtualSpace />} />
                </Routes>
            </BrowserRouter>
        </TezosWalletProvider>
    )
}

export default AppRouter;