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
import User from './routes/User';
import Item from './routes/Item';
import DirectoryMap from './routes/DirectoryMap';
import { getiFrameControl } from './forms/DirectoryForm';
import Event from './routes/Event';


function AppRouter(props: React.PropsWithChildren<{}>) {
    return (
        <TezosWalletProvider>
            <BrowserRouter>
                {props.children}
                <Routes>
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

                        <Route path="u/:address" element={<User />} />
                        <Route path="i/:id" element={<Item />} />

                        {isDev() ? <Route path="genmap" element={<GenerateMap />} /> : null}
                        <Route path="*" element={<PageNotFound />}/>
                    </Route>
                    {getiFrameControl(window) &&
                    <Route path="/directory" element={<DirectoryLayout />}>
                        <Route path="" element={<ComingSoon />} />
                        <Route path="map" element={<DirectoryMap />} />
                        <Route path="event/:eventName" element={<Event />} />

                        <Route path="u/:address" element={<User />} />
                        <Route path="i/:id" element={<Item />} />

                        <Route path="*" element={<PageNotFound />}/>
                    </Route> }
                    <Route path="/explore" element={<Explore />} />
                </Routes>
            </BrowserRouter>
        </TezosWalletProvider>
    )
}

export default AppRouter;