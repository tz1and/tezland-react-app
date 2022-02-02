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
import Metadata from './world/Metadata';
import { Notification } from './components/Notification';
import { sleep } from './utils/Utils';


// TODO: find a better way to do this, see todo.
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

const renderCallback = () => {
    sleep(500).then(() => {
        const loader = document.getElementById('loader-container')
        if(!loader) return;

        loader.classList.add("hidden");
        sleep(500).then(() => {
            loader.remove();
        });
    });
}

const renderApp = (element?: JSX.Element) => {
    ReactDOM.render(
        <React.StrictMode>
            <AppRouter>
                {element}
            </AppRouter>
        </React.StrictMode>,
        document.getElementById('root'),
        renderCallback
    );
}



// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals();
