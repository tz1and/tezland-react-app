import React, { Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auctions from './routes/Auctions';
import { CreateAuctionFormW } from './forms/CreateAuction';
import { Map } from './routes/Map';
//import ComingSoon from './routes/ComingSoon';
import SiteLayout from './routes/SiteLayout';
import DirectoryLayout from './layouts/DirectoryLayout';
import { DirectoryFooterPadding } from './components/DirectoryFooterPadding';
import Frontpage from './routes/Frontpage';
import Faq from './routes/Faq';
import Docs from './routes/Docs';
import Terms from './routes/Terms';
import Privacy from './routes/Privacy';
import MintFormWrapper from './forms/MintFormWrapper';
import PageNotFound from './routes/PageNotFound';
import { TezosWalletProvider } from './components/TezosWalletContext'
import { isDev } from './utils/Utils';
import User from './routes/directory/User';
import Item from './routes/directory/Item';
import { DirectoryMap } from './routes/DirectoryMap';
import { EventMap } from './routes/EventMap';
import { Tag } from './routes/directory/Tag';
import { PlacePage } from './routes/directory/PlacePage';
import { Search } from './routes/directory/Search';
import { NewMints } from './routes/directory/NewMints';
import { NewSwaps } from './routes/directory/NewSwaps';
import { TypedArtBlog } from './routes/blog/TypedArtBlog';
import { TypedArtBlogPost } from './routes/blog/TypedArtBlogPost';
import { TypedArtPostType } from './routes/blog/TypedArtUtils';
import EnterDirectory from './routes/EnterDirectory';


const Loading = () => <div className="d-flex justify-content-center align-items-center" style={{height: "100%"}}>
    <div className="spinner-border text-primary" style={{width: "6rem", height: "6rem"}} role="status">
        <span className="visually-hidden">Loading...</span>
    </div>
</div>;

const Explore = React.lazy(() => import('./components/Explore'));
const GenerateMap = React.lazy(() => import('./routes/GenerateMap'));
const Acknowledgements = React.lazy(() => import('./routes/Acknowledgements'));

function AppRouter(props: React.PropsWithChildren<{}>) {
    const [directoryEnabled, setDirectoryEnabled] = useState(false);

    const directoryRoutes = <>
        <Route path="search" element={<Search />} />
        <Route path="event/:eventTag/:eventLabel" element={<EventMap />} />

        <Route path="u/:address" element={<User />} />
        <Route path="i/:id" element={<Item />} />
        <Route path="p/:id" element={<PlacePage />} />
        <Route path="t/:tag" element={<Tag />} />

        <Route path="new">
            <Route path="mints" element={<NewMints />} />
            <Route path="swaps" element={<NewSwaps />} />
        </Route>
    </>;

    return (
        <TezosWalletProvider>
            <BrowserRouter>
                {props.children}
                <Routes>
                    {!directoryEnabled ?
                        <Route path="/" element={
                            <Suspense fallback={<Loading />}>
                                <SiteLayout />
                            </Suspense>}>
                            <Route path="" element={<Frontpage />} />

                            <Route path="mint" element={<MintFormWrapper />}/>

                            <Route path="auctions">
                                <Route path="" element={<Auctions />} />
                                <Route path="create" element={<CreateAuctionFormW />} />
                            </Route>
                            <Route path="map" element={<Map />} />

                            <Route path="docs" element={<Docs />} />
                            <Route path="faq" element={<Faq />} />
                            <Route path="privacy" element={<Privacy />} />
                            <Route path="terms" element={<Terms />} />
                            <Route path="acknowledgements" element={<Acknowledgements />} />

                            <Route path="blog">
                                <Route path="" element={<TypedArtBlog tag={TypedArtPostType.Blog} />} />
                                <Route path=":id" element={<TypedArtBlogPost />} />
                                <Route path="featured" element={<TypedArtBlog tag={TypedArtPostType.Featured} />} />
                            </Route>

                            {directoryRoutes}

                            {isDev() ? <Route path="genmap" element={<GenerateMap />} /> : null}
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
                    <Route path="/explore" element={
                        <Suspense fallback={<Loading />}>
                            <Explore />
                        </Suspense>} />
                </Routes>
            </BrowserRouter>
        </TezosWalletProvider>
    )
}

export default AppRouter;