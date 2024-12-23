import { Link } from "react-router-dom";
import Conf from "../Config";

export default function Footer() {
    return (
        <footer className="container py-5">
            <div className="row">
                <div className="col-6 col-md">
                    {/*<img src="/logo192.png" width="64" height="64" /><br /><br />*/}
                    tz1and
                    <small className="d-block mb-4 text-muted">© 2023</small>
                    <small className="d-block text-muted">v{Conf.app_version} (beta)</small>
                </div>
                <div className="col-6 col-md">
                    <h5>Virtual World</h5>
                    <ul className="list-unstyled text-small">
                        <li><Link to="/explore" className="link-secondary">Explore</Link></li>
                        <li><Link to="/auctions" className="link-secondary">Place Auctions</Link></li>
                        <li><Link to="/map" className="link-secondary">Map</Link></li>
                    </ul>
                </div>
                <div className="col-6 col-md">
                    <h5>Resources</h5>
                    <ul className="list-unstyled text-small">
                        {/*<li><Link className="link-secondary" to="/docs">Documentation</Link></li>*/}
                        <li><Link className="link-secondary" to="/tools">Tools</Link></li>
                        <li><Link className="link-secondary" to="/faq">FAQ</Link></li>
                        <li><a className="link-secondary" target="_blank" rel="noreferrer" href="https://www.github.com/tz1and">GitHub</a></li>
                    </ul>
                </div>
                <div className="col-6 col-md">
                    <h5>About</h5>
                    <ul className="list-unstyled text-small">
                        <li><Link className="link-secondary" to="/acknowledgements">Acknowledgements</Link></li>
                        {/*<li><Link className="link-secondary" to="/team">Team</Link></li>*/}
                        <li><Link className="link-secondary" to="/terms">Terms</Link></li>
                        <li><Link className="link-secondary" to="/privacy">Privacy Policy</Link></li>
                        {/*<li><a className="link-secondary" href="mailto:contact@todo.com">Contact</a></li>*/}
                    </ul>
                </div>
                <div className="col-6 col-md">
                    <h5>Socials</h5>
                    <ul className="list-unstyled text-small">
                        <li><a className="link-secondary" target="_blank" rel="noreferrer" href="https://discord.gg/fbpy4QdzSp">Discord</a></li>
                        <li><a className="link-secondary" target="_blank" rel="noreferrer" href="https://twitter.com/tz1and">Twitter</a></li>
                        {/*<li><a className="link-secondary" target="_blank" rel="noreferrer" href="https://t.me/tz1and">Telegram</a></li>
                        <li><a className="link-secondary" target="_blank" rel="noreferrer" href="https://www.instagram.com/tz1and/">Instagram</a></li>*/}
                    </ul>
                </div>
            </div>
        </footer>
    );
}