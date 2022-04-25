import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import $ from 'jquery'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { createPopper } from '@popperjs/core'; // eslint-disable-line @typescript-eslint/no-unused-vars
import 'bootstrap';

import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
//import reportWebVitals from './reportWebVitals';
import AppRouter from './AppRouter';
import Metadata from './world/Metadata';
import { Notification } from './components/Notification';
import { isDev, sleep } from './utils/Utils';
import { upgradeSettings } from './storage';
import Conf from './Config';

// make sure the default settings are up to date.
upgradeSettings();

Metadata.Storage.open(() => {
    renderApp();
}, () => {
    renderApp(
        (<div className="toast-container position-fixed bottom-0 start-50 translate-middle-x p-4" style={{zIndex: "1050"}}>
            <Notification data={{
                id: "storageFailure",
                title: "Failed to open Database storage",
                body: "The app may not function correctly.\n\nCheck the Javascript console for more details. It could also be your privacy settings (or a private tab).",
                type: 'danger' }}/>
        </div>)
    );
})


function Root(props: React.PropsWithChildren<{}>) {
    useEffect(() => {
        sleep(500).then(() => {
            const loader = document.getElementById('loader-container')
            if (!loader) return;

            loader.classList.add("hidden");
            sleep(500).then(() => {
                loader.remove();
            });
        });
    });

    const testnetNotify = Conf.tezos_network !== "mainnet" ?
        <div className="toast-container position-fixed bottom-0 start-50 translate-middle-x p-4" style={{ zIndex: "1050" }}>
            <Notification data={{
                id: "liveOnTestnet",
                title: "Live on testnet",
                body: <span>tz1and is live on the testnet! Again! To give it a try, grab an account <a href="https://teztnets.xyz/" target="_blank" rel="noreferrer">from the faucet</a> and import it in TempleWallet.</span>,
                type: 'info'
            }} />
        </div> : null

    return <React.StrictMode>
        <AppRouter>
            {props.children}
            {isDev() ? <div className='bg-danger text-light text-center align-middle py-2 fixed-bottom'><b>DEVELOPMENT - DEVELOPMENT - DEVELOPMENT - DEVELOPMENT</b></div> : null}
            {testnetNotify}
        </AppRouter>
    </React.StrictMode>
}


const renderApp = (element?: JSX.Element) => {
    const root = createRoot(document.getElementById('root')!);
    root.render(<Root>{element}</Root>);
}



// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals();
