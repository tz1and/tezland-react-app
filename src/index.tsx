import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import $ from 'jquery'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { createPopper } from '@popperjs/core'; // eslint-disable-line @typescript-eslint/no-unused-vars
import 'bootstrap/dist/js/bootstrap.bundle.min';

import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import SiteLayout from './routes/SiteLayout';
import Frontpage from './routes/Frontpage';
import Auctions from './routes/Auctions';
import Faq from './routes/Faq';
import Docs from './routes/Docs';
import Map from './routes/Map';
import { CreateAuctionForm } from './forms/CreateAuction';
import Contracts from "./tz/Contracts";
import { TempleWallet } from "@temple-wallet/dapp";

TempleWallet.onAvailabilityChange((avail) => { Contracts.initWallet() });

ReactDOM.render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<SiteLayout />}>
                    <Route path="" element={<Frontpage />} />
                    <Route path="auctions">
                        <Route path="" element={<Auctions />} />
                        <Route path="create" element={<CreateAuctionForm />} />
                    </Route>
                    <Route path="faq" element={<Faq />} />
                    <Route path="docs" element={<Docs />} />
                    <Route path="map" element={<Map />} />
                </Route>
                <Route path="/explore" element={<App />} />
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
    </React.StrictMode>,
    document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
