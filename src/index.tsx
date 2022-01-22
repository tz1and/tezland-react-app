import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import $ from 'jquery'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { createPopper } from '@popperjs/core'; // eslint-disable-line @typescript-eslint/no-unused-vars
import 'bootstrap/dist/js/bootstrap.bundle.min';

import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import reportWebVitals from './reportWebVitals';
import AppRouter from './AppRouter';
import Metadata from './world/Metadata';


// TODO: find a better way to do this, see todo.
Metadata.Storage.open(() => {
    renderApp();
}, () => {
    renderApp(
        (<div className="position-fixed bottom-0 start-0 p-4" style={{zIndex: "1050"}}>
            <div className="toast align-items-center text-white bg-danger border-0 show" role="alert" aria-live="assertive" aria-atomic="true">
                <div className="d-flex">
                    <div className="toast-body">
                        <p className='mb-3 fw-bolder'>Failed to open Database storage</p>
                        The app may not function correctly.<br/><br/>
                        Check the Javascript console for more details.<br/>
                        It could also be your privacy settings (or a private tab).
                    </div>
                    <button type="button" className="btn-close btn-close-white me-2 mt-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        </div>)
    );
})

const renderApp = (element?: JSX.Element) => {
    ReactDOM.render(
        <React.StrictMode>
            <AppRouter>
                {element}
            </AppRouter>
        </React.StrictMode>,
        document.getElementById('root')
    );
}



// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
