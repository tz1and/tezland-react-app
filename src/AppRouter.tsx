import React from 'react'; // we need this to make JSX compile
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Explore from './components/Explore';
import Auctions from './routes/Auctions';
import { CreateAuctionFormW } from './forms/CreateAuction';
import Map from './routes/Map';
import ComingSoon from './routes/ComingSoon';
import SiteLayout from './routes/SiteLayout';
import DirectoryLayout from './layouts/DirectoryLayout';
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
import DirectoryMap from './routes/DirectoryMap';
import { getiFrameControl } from './forms/DirectoryForm';
import Event from './routes/Event';
import { Tag } from './routes/directory/Tag';
import { PlacePage } from './routes/directory/PlacePage';
import { Search } from './routes/directory/Search';


function AppRouter(props: React.PropsWithChildren<{}>) {
    const iframeControl = getiFrameControl(window);

    return (
        <TezosWalletProvider>
            <BrowserRouter>
                {props.children}
                <Routes>
                    {!iframeControl &&
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

                        <Route path="search" element={<Search />} />
                        <Route path="u/:address" element={<User />} />
                        <Route path="i/:id" element={<Item />} />
                        <Route path="p/:id" element={<PlacePage />} />
                        <Route path="t/:tag" element={<Tag />} />

                        {isDev() ? <Route path="genmap" element={<GenerateMap />} /> : null}
                        <Route path="*" element={<PageNotFound />}/>
                    </Route> }
                    {iframeControl &&
                    <Route path="/directory" element={<DirectoryLayout />}>
                        <Route path="" element={<Search />} />
                        <Route path="map" element={<DirectoryMap />} />
                        <Route path="event/:eventName/:eventLabel" element={<Event />} />

                        <Route path="u/:address" element={<User />} />
                        <Route path="i/:id" element={<Item />} />
                        <Route path="p/:id" element={<PlacePage />} />
                        <Route path="t/:tag" element={<Tag />} />

                        <Route path="*" element={<PageNotFound />}/>
                    </Route> }
                    <Route path="/explore" element={<Explore />} />
                </Routes>
            </BrowserRouter>
        </TezosWalletProvider>
    )
}

export default AppRouter;