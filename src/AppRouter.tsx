import React from 'react'; // we need this to make JSX compile
import { BrowserRouter, Routes, Route } from "react-router-dom";
//import Explore from './components/Explore';
import ComingSoon from './routes/ComingSoon';
import SiteLayout from './routes/SiteLayout';
import Frontpage from './routes/Frontpage';
import Auctions from './routes/Auctions';
import Faq from './routes/Faq';
import Docs from './routes/Docs';
import Map from './routes/Map';
import GenerateMap from './routes/GenerateMap';
import PageNotFound from './routes/PageNotFound';
import { CreateAuctionFormW } from './forms/CreateAuction';
import { TezosWalletProvider } from './components/TezosWalletContext'
import { isDev } from './utils/Utils';


function AppRouter(props: React.PropsWithChildren<{}>) {
    return (
        <TezosWalletProvider>
            <BrowserRouter>
                {props.children}
                <Routes>
                    <Route path="/" element={<SiteLayout />}>
                        <Route path="" element={<Frontpage />} />

                        {/* TEMP: actual routes */}
                        {/*<Route path="auctions">
                            <Route path="" element={<Auctions />} />
                            <Route path="create" element={<CreateAuctionFormW />} />
                        </Route>
                        <Route path="map" element={<Map />} />*/}

                        {/* TEMP: coming soon */}
                        <Route path="auctions" element={<ComingSoon />} />
                        <Route path="map" element={<ComingSoon />} />
                        <Route path="explore" element={<ComingSoon />} />

                        <Route path="docs" element={<Docs />} />
                        <Route path="faq" element={<Faq />} />
                        {isDev() ? <Route path="genmap" element={<GenerateMap />} /> : null}
                        <Route path="*" element={<PageNotFound />}/>
                    </Route>
                    {/* TEMP: actual explore routes */}
                    {/*<Route path="/explore" element={<Explore />} />*/}
                </Routes>
            </BrowserRouter>
        </TezosWalletProvider>
    )
}

export default AppRouter;