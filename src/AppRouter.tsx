import React from 'react'; // we need this to make JSX compile
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Explore from './components/Explore';
import Auctions from './routes/Auctions';
import { CreateAuctionFormW } from './forms/CreateAuction';
import Map from './routes/Map';
//import ComingSoon from './routes/ComingSoon';
import SiteLayout from './routes/SiteLayout';
import Frontpage from './routes/Frontpage';
import Faq from './routes/Faq';
import Docs from './routes/Docs';
import GenerateMap from './routes/GenerateMap';
import PageNotFound from './routes/PageNotFound';
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

                        <Route path="auctions">
                            <Route path="" element={<Auctions />} />
                            <Route path="create" element={<CreateAuctionFormW />} />
                        </Route>
                        <Route path="map" element={<Map />} />

                        <Route path="docs" element={<Docs />} />
                        <Route path="faq" element={<Faq />} />
                        {isDev() ? <Route path="genmap" element={<GenerateMap />} /> : null}
                        <Route path="*" element={<PageNotFound />}/>
                    </Route>
                    <Route path="/explore" element={<Explore />} />
                </Routes>
            </BrowserRouter>
        </TezosWalletProvider>
    )
}

export default AppRouter;