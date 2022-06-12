import { Link } from "react-router-dom";
import './Navigation.css';
//import WalletWidget from "./WalletWidget";

export default function DirectoryNavigation() {
    return (
        <header className="sticky-top py-3 bg-white text-dark">
            <div className="px-0">
                <div className="d-flex flex-wrap align-items-center justify-content-start">
                    <Link to="/directory/map" className="d-flex align-items-center mb-2 mb-lg-0 text-dark text-decoration-none me-3">
                        <img src="/logo_header.png" alt="tz1and" height="40" /> <h5 className="mb-0">Directory Services</h5>
                    </Link>

                    <ul className="nav me-auto mb-2 justify-content-center mb-md-0">
                        <li><Link to="/directory/map" className="nav-link px-2">Map</Link></li>
                        <li><Link to="/directory" className="nav-link px-2">Directory</Link></li>
                    </ul>

                    {/*<WalletWidget/>*/}
                </div>
            </div>
        </header>
    );
}