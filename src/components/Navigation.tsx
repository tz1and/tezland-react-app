import { Link } from "react-router-dom";
import './Navigation.css';
import { useTezosWalletContext } from "./TezosWalletContext";

export default function Frontpage() {
    const context = useTezosWalletContext()
    return (
        <header className="sticky-top p-3 bg-white text-dark">
            <div className="container">
                <div className="d-flex flex-wrap align-items-center justify-content-start">
                    <Link to="/" className="d-flex align-items-center mb-2 mb-lg-0 text-dark text-decoration-none me-5">
                        <img className="me-3" src="/logo192.png" alt="" width="40" height="40" />
                        <span className="fs-4">[tz1aND]</span>
                    </Link>

                    <ul className="nav me-auto mb-2 justify-content-center mb-md-0">
                        <li><Link to="/" className="nav-link px-2">Home</Link></li>
                        <li><Link to="/auctions" className="nav-link px-2">Place Auctions</Link></li>
                        <li><Link to="/faq" className="nav-link px-2">FAQ</Link></li>
                        {/*<li><Link to="/docs" className="nav-link px-2">Docs</Link></li>*/}
                        <li><Link to="/map" className="nav-link px-2">Map</Link></li>
                        {/*<li><Link to="/explore" className="nav-link px-2">Explore</Link></li>*/}
                    </ul>

                    <Link to="/explore" className="btn btn-primary mb-auto">Explore</Link>
                    { context.isWalletConnected() ?
                        <button className="btn btn-danger mb-auto ms-3" onClick={() => context.disconnectWallet()}>Disonnect Wallet</button> :
                        <button className="btn btn-success mb-auto ms-3" onClick={() => context.connectWallet()}>Connect Wallet</button>
                    }
                </div>
            </div>
        </header>
    );
}