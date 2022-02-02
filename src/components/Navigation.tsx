import { Link } from "react-router-dom";
import './Navigation.css';
import WalletWidget from "./WalletWidget";

export default function Frontpage() {
    return (
        <header className="sticky-top py-3 bg-white text-dark">
            <div className="container px-0">
                <div className="d-flex flex-wrap align-items-center justify-content-start">
                    <Link to="/" className="d-flex align-items-center mb-2 mb-lg-0 text-dark text-decoration-none me-3">
                        <img src="/logo_header.png" alt="tz1and" height="40" />
                    </Link>

                    <ul className="nav me-auto mb-2 justify-content-center mb-md-0">
                        <li><Link to="/" className="nav-link px-2">Home</Link></li>
                        <li><Link to="/auctions" className="nav-link px-2">Place Auctions</Link></li>
                        <li><Link to="/faq" className="nav-link px-2">FAQ</Link></li>
                        {/*<li><Link to="/docs" className="nav-link px-2">Docs</Link></li>*/}
                        <li><Link to="/map" className="nav-link px-2">Map</Link></li>
                        <li><Link to="/explore" className="nav-link px-2">Explore</Link></li>
                    </ul>

                    <WalletWidget/>
                </div>
            </div>
        </header>
    );
}