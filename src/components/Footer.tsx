import { Link } from "react-router-dom";

export default function Frontpage() {
    return (
        <footer className="container py-5">
            <div className="row">
                <div className="col-6 col-md">
                    {/*<img src="/logo192.png" width="64" height="64" /><br /><br />*/}
                    tz1aND
                    <small className="d-block mb-3 text-muted">© 2021</small>
                </div>
                <div className="col-6 col-md">
                    <h5>Virtual World</h5>
                    <ul className="list-unstyled text-small">
                        <li><Link to="/auctions" className="link-secondary">Land Auctions</Link></li>
                        <li><Link to="/explore" className="link-secondary">Explore</Link></li>
                    </ul>
                </div>
                <div className="col-6 col-md">
                    <h5>Resources</h5>
                    <ul className="list-unstyled text-small">
                        <li><Link className="link-secondary" to="/faq">FAQ</Link></li>
                        <li><Link className="link-secondary" to="/docs">Documentation</Link></li>
                        <li><a className="link-secondary" target="_blank" rel="noreferrer" href="https://www.github.com">GitHub</a></li>
                    </ul>
                </div>
                <div className="col-6 col-md">
                    <h5>About</h5>
                    <ul className="list-unstyled text-small">
                        <li><Link className="link-secondary" to="/team">Team</Link></li>
                        <li><Link className="link-secondary" to="/lol">Privacy</Link></li>
                        <li><Link className="link-secondary" to="/terms">Terms</Link></li>
                        <li><a className="link-secondary" href="mailto:contact@todo.com">Contact</a></li>
                    </ul>
                </div>
                <div className="col-6 col-md">
                    <h5>Socials</h5>
                    <ul className="list-unstyled text-small">
                        <li><a className="link-secondary" target="_blank" rel="noreferrer" href="https://discord.gg/todo">Discord</a></li>
                        <li><a className="link-secondary" target="_blank" rel="noreferrer" href="https://t.me/TODO">Telegram</a></li>
                        <li><a className="link-secondary" target="_blank" rel="noreferrer" href="https://www.instagram.com/todo/">Instagram</a></li>
                        <li><a className="link-secondary" target="_blank" rel="noreferrer" href="https://twitter.com/todo">Twitter</a></li>
                    </ul>
                </div>
            </div>
        </footer>
    );
}