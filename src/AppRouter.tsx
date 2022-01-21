import React from 'react'; // we need this to make JSX compile
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Explore from './components/Explore';
import SiteLayout from './routes/SiteLayout';
import Frontpage from './routes/Frontpage';
import Auctions from './routes/Auctions';
import Faq from './routes/Faq';
import Docs from './routes/Docs';
import Map from './routes/Map';
import GenerateMap from './routes/GenerateMap';
import { CreateAuctionFormW } from './forms/CreateAuction';
import Contracts from "./tz/Contracts";
//import { TezosWalletContext } from './components/TezosWalletContext'

Contracts.initWallet();

const AppRouter = () => {
    /*<TezosWalletContext.Provider value={{}}>
    </TezosWalletContext.Provider>*/
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<SiteLayout />}>
                    <Route path="" element={<Frontpage />} />
                    <Route path="auctions">
                        <Route path="" element={<Auctions />} />
                        <Route path="create" element={<CreateAuctionFormW />} />
                    </Route>
                    <Route path="faq" element={<Faq />} />
                    <Route path="docs" element={<Docs />} />
                    <Route path="map" element={<Map />} />
                    <Route path="genmap" element={<GenerateMap />} />
                </Route>
                <Route path="/explore" element={<Explore />} />
                <Route
                    path="*"
                    element={
                        <main style={{ padding: "1rem" }}>
                            <p>There's nothing here!</p>
                        </main>
                    }
                />
            </Routes>
        </BrowserRouter>
    )
}

export default AppRouter;