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
import { TezosWalletProvider } from './components/TezosWalletContext'

//Contracts.initWallet();

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
        </TezosWalletProvider>
    )
}

export default AppRouter;