import React, { useState } from 'react'; // we need this to make JSX compile
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Explore from './components/Explore';
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
import GenerateMap from './routes/GenerateMap';
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
import EnterDirectory from './routes/EnterDirectory';
import Acknowledgements from './routes/Acknowledgements';


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
                        <Route path="/" element={<SiteLayout />}>
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
                                <Route path="" element={<TypedArtBlog tag="tz1andblog" />} />
                                <Route path=":id" element={<TypedArtBlogPost />} />
                                <Route path="featured" element={<TypedArtBlog tag="tz1andfeatured" />} />
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
                    <Route path="/explore" element={<Explore />} />
                </Routes>
            </BrowserRouter>
        </TezosWalletProvider>
    )
}

export default AppRouter;