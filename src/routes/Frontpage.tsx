//import { Link } from "react-router-dom";
import { Link } from 'react-router-dom';
import './Frontpage.css';

export default function Frontpage() {
    return (
        <main>
            <div className="px-4 pt-5 my-5 text-center border-bottom">
                <h1 className="display-4 fw-bold">A Virtual World and NFT Marketplace</h1>
                <div className="col-lg-6 mx-auto">
                    <p className="lead mb-4">Lorem ipsum let's build a piece of art. Expanding, not based on scarcity.</p>
                    <div className="d-grid gap-2 d-sm-flex justify-content-sm-center mb-5">
                        <Link to="/explore" target="_blank" className="btn btn-primary btn-lg px-4 me-sm-3">Explore</Link>
                        <Link to="/faq" className="btn btn-outline-secondary btn-lg px-4">Learn More</Link>
                    </div>
                </div>
                <div className="overflow-hidden" style={{maxHeight: "50vh"}}>
                    <div className="container px-5">
                        <img src="/img/world_screenshot.png" className="img-fluid border rounded-3 shadow-lg mb-4" alt="A screenshot of the virtual world."
                            width="100%" loading="lazy" />
                    </div>
                </div>
            </div>

            <div className="container col-xxl-8 px-0 py-2">
                <div className="row flex-lg-row-reverse align-items-center g-5 py-5">
                    <div className="col-10 col-sm-8 col-lg-6">
                        <img src="/img/map_screenshot.png" className="d-block mx-lg-auto img-fluid" alt="Bootstrap Themes" width="700"
                            height="500" loading="lazy" />
                    </div>
                    <div className="col-lg-6">
                        <h1 className="display-5 fw-bold lh-1 mb-3">Ever Expanding</h1>
                        <p className="lead">The world will be expanded at a pace that makes sense and new Places will become available regularly.</p>
                    </div>
                </div>
            </div>

            <div className="container col-xxl-8 px-0 py-2">
                <div className="row flex-lg-row-reverse align-items-center g-5 py-5">
                    <div className="col-lg-6">
                        <h1 className="display-5 fw-bold lh-1 mb-3">Build Together</h1>
                        <p className="lead">Some point about collaboration.</p>
                        <p className="lead">Let's build something cool, together.</p>
                        {/*<div className="d-grid gap-2 d-md-flex justify-content-md-start">
                            <a className="btn btn-primary btn-lg px-4 me-md-2">Primary</a>
                            <Link to="/faq" className="btn btn-outline-secondary btn-lg px-4">Learn More</Link>
                        </div>*/}
                    </div>
                    <div className="col-10 col-sm-8 col-lg-6">
                        <img src="/img/world_screenshot.png" className="d-block mx-lg-auto img-fluid" alt="Bootstrap Themes" width="700"
                            height="500" loading="lazy" />
                    </div>
                </div>
            </div>

            <div className="container col-xxl-8 px-0 py-2">
                <div className="row flex-lg-row-reverse align-items-center g-5 py-5">
                    <div className="col-10 col-sm-8 col-lg-6">
                        <img src="/img/tezos_ipfs.png" className="d-block mx-lg-auto img-fluid" alt="Bootstrap Themes" width="700"
                            height="500" loading="lazy" />
                    </div>
                    <div className="col-lg-6">
                        <h1 className="display-5 fw-bold lh-1 mb-3">Decentralised!</h1>
                        <p className="lead">As in: actually decentralised.<br/>Everything is stored either on the Tezos blockchain or on IPFS. This website is just a portal, there could be others.</p>
                    </div>
                </div>
            </div>

            <div className="container my-5 text-center">
                <div className="p-5 align-items-center rounded-3 border shadow-lg bg-dark text-white bg-whitelist">
                    <h1 className="display-5 fw-bold">Get a Place</h1>
                    <div className="col-lg-10 mx-auto">
                        <p className="lead">If there are any available right now :)</p>
                        <p className="lead">I did consider making Places free. Think of it as supporting development and paying the bills.</p>
                        <div className="d-grid gap-2 d-sm-flex justify-content-sm-center">
                            <Link to="/auctions" className="btn btn-primary btn-lg px-4 gap-3">List Auctions</Link>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}