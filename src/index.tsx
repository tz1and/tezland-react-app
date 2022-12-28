import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import $ from 'jquery'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { createPopper } from '@popperjs/core'; // eslint-disable-line @typescript-eslint/no-unused-vars
import 'bootstrap';

import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
//import reportWebVitals from './reportWebVitals';
import AppRouter from './AppRouter';
import { Notification } from './components/Notification';
import { upgradeSettings } from './storage/AppSettings';
import Metadata from './world/Metadata';
import { Logging } from './utils/Logging';
import { isDev, sleep } from './utils/Utils';
import Conf from './Config';
import { HelmetProvider } from 'react-helmet-async';


function InitialiseApp() {
    // make sure the default settings are up to date.
    upgradeSettings();

    Metadata.InitialiseStorage().then(() => {
        RunApp();
    }).catch((e) => {
        Logging.Error("Failed to initialise database:", e);
        RunApp(false);
    });
}

const RenderCallback = () => {
    sleep(500).then(() => {
        const loader = document.getElementById('loader-container')
        if(!loader) return;

        loader.classList.add("pre-hidden");
        sleep(500).then(() => {
            loader.remove();
        });
    });
}

function RunApp(dbInitSuccess: boolean = true) {
    // TODO: react 18 style. Can't do it now because it does silly stuff like
    // mounting components twice in development and that breaks some stuff...
    //const container = document.getElementById('root');
    //const root = createRoot(container!);

    const dbFailedNotify = !dbInitSuccess ?
        <div className="toast-container position-fixed bottom-0 start-50 translate-middle-x p-4" style={{zIndex: "1050"}}>
            <Notification data={{
                id: "storageFailure",
                title: "Failed to open Database storage",
                body: "The app may not function correctly.\n\nCheck the Javascript console for more details. It could also be your privacy settings (or a private tab).",
                type: 'danger' }}/>
        </div> : undefined;

    const testnetNotify = Conf.tezos_network !== "mainnet" ?
        <div className="toast-container position-fixed bottom-0 start-50 translate-middle-x p-4" style={{zIndex: "1050"}}>
            <Notification data={{
                id: "liveOnTestnet",
                title: "Live on testnet",
                body: <span>tz1and is live on the testnet! Again! To give it a try, grab an account <a href="https://teztnets.xyz/" target="_blank" rel="noreferrer">from the faucet</a> and import it in TempleWallet.</span>,
                type: 'info' }}/>
        </div> : undefined;

    // TODO: react 18 style
    //root.render(...);
    ReactDOM.render(
        <React.StrictMode>
            <HelmetProvider>
                <AppRouter>
                    {dbFailedNotify}
                    { isDev() ? <div className='bg-danger text-light text-center align-middle py-2 fixed-bottom'><b>DEVELOPMENT - DEVELOPMENT - DEVELOPMENT - DEVELOPMENT</b></div> : null }
                    {testnetNotify}
                </AppRouter>
            </HelmetProvider>
        </React.StrictMode>,
        document.getElementById('root'),
        RenderCallback
    );
}

InitialiseApp();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals(console.log);
