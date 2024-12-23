import { Link } from 'react-router-dom';
import './Frontpage.css'

import world_screenshot from '../img/world_screenshot.webp';
import map_screenshot from '../img/map_screenshot.webp';
import community_screenshot from '../img/district4_snapshot2.webp';
import tezos_ipfs from '../img/tezos_ipfs.webp';

export default function Frontpage() {
    return (
        <main>
            <div className="px-4 pt-5 my-5 text-center border-bottom">
                <h1 className="display-3">A Virtual World and NFT Marketplace</h1>
                <div className="col-lg-6 mx-auto">
                    <p className="lead mb-4">Lorem ipsum... let's build a piece of art. Expanding, not based on scarcity.</p>
                    <div className="d-grid gap-2 d-sm-flex justify-content-sm-center mb-5">
                        <Link to="/explore" className="btn btn-primary btn-lg px-4 me-sm-3 shadow">Explore</Link>
                        <Link to="/faq" className="btn btn-outline-secondary btn-lg px-4 shadow-sm">Learn More</Link>
                    </div>
                </div>
                <div className="overflow-hidden" style={{maxHeight: "50vh"}}>
                    <div className="container px-0 px-md-5">
                        <img src={world_screenshot} className="img-fluid border rounded-3 shadow-lg mb-4" alt="A screenshot of the virtual world."
                            width="100%" loading="lazy" />
                    </div>
                </div>
            </div>

            <div className="container col-xxl-8 px-0 py-2">
                <div className="row flex-lg-row-reverse align-items-center g-5 py-5">
                    <div className="col-lg-6 mx-4 mx-md-0">
                        <h1>Decentralised</h1>
                        <p className="lead">No, for reals.<br/>Everything is stored either on
                            the <a className='link-info text-decoration-none' href="https://tezos.com/" target="_blank" rel="noreferrer">Tezos</a> blockchain or
                            on <a className='link-info text-decoration-none' href="https://ipfs.io/" target="_blank" rel="noreferrer">IPFS</a>. This website is just a portal, there could be others.</p>
                    </div>
                    <div className="col-10 col-sm-8 col-lg-6 mx-auto mx-md-0">
                        <img src={tezos_ipfs} className="d-block img-fluid rounded-3 shadow" alt="Bootstrap Themes" width="700"
                            height="500" loading="lazy" />
                    </div>
                </div>
            </div>

            <div className="container col-xxl-8 px-0 py-2">
                <div className="row flex-lg-row-reverse align-items-center g-5 py-5">
                    <div className="col-10 col-sm-8 col-lg-6 mx-auto mx-md-0">
                        <img src={map_screenshot} className="d-block img-fluid rounded-3 shadow" alt="Bootstrap Themes" width="700"
                            height="500" loading="lazy" />
                    </div>
                    <div className="col-lg-6 mx-4 mx-md-0">
                        <h1>Ever Expanding</h1>
                        <p className="lead">The World will be expanded at a pace that makes sense and new Places will become available regularly.</p>
                    </div>
                </div>
            </div>

            <div className="container col-xxl-8 px-0 py-2">
                <div className="row flex-lg-row-reverse align-items-center g-5 py-5">
                    <div className="col-lg-6 mx-4 mx-md-0">
                        <h1>Build Together</h1>
                        <p className="lead">Imagine some clever point about collaboration here.<br/>Let's build something big, together.</p>
                        {/*<div className="d-grid gap-2 d-md-flex justify-content-md-start">
                            <a className="btn btn-primary btn-lg px-4 me-md-2">Primary</a>
                            <Link to="/faq" className="btn btn-outline-secondary btn-lg px-4">Learn More</Link>
                        </div>*/}
                    </div>
                    <div className="col-10 col-sm-8 col-lg-6 mx-auto mx-md-0">
                        <img src={world_screenshot} className="d-block img-fluid rounded-3 shadow" alt="Bootstrap Themes" width="700"
                            height="500" loading="lazy" />
                    </div>
                </div>
            </div>

            <div className="container col-xxl-8 px-0 py-2">
                <div className="row flex-lg-row-reverse align-items-center g-5 py-5">
                    <div className="col-10 col-sm-8 col-lg-6 mx-auto mx-md-0">
                        <img src={community_screenshot} className="d-block img-fluid rounded-3 shadow" alt="Bootstrap Themes" width="700"
                            height="500" loading="lazy" />
                    </div>
                    <div className="col-lg-6 mx-4 mx-md-0">
                        <h1>Community</h1>
                        <p className="lead">Feel free to join our Discord for discussion, updates and to meet nice people.</p>
                        <a href="https://discord.gg/fbpy4QdzSp" target="_blank" rel="noreferrer" className="btn btn-primary">Join Discord</a>
                    </div>
                </div>
            </div>

            <div className="my-5 text-center">
                <div className="p-5 align-items-center border shadow-lg bg-dark text-white bg-whitelist">
                    <h1 className="display-4">Get a Place</h1>
                    <div className="col-lg-10 mx-auto">
                        <p className="lead">If there are any available right now :)</p>
                        <p className="lead">I did consider making Places free. Think of it as supporting development and paying the bills.</p>
                        <div className="d-grid gap-2 d-sm-flex justify-content-sm-center">
                            <Link to="/auctions" className="btn btn-light btn-lg mt-3 px-4">List Auctions</Link>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}