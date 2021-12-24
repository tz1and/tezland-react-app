import { Link } from "react-router-dom";
import './Navigation.css';

export default function Frontpage() {
    return (
        <header className="sticky-top p-3 bg-dark text-white">
            <div className="container">
                <div className="d-flex flex-wrap align-items-center justify-content-start">
                    <Link to="/" className="d-flex align-items-center mb-2 mb-lg-0 text-white text-decoration-none me-5">
                        <img className="me-3" src="logo192.png" alt="" width="40" height="40" />
                        <span className="fs-4">tz1aND</span>
                    </Link>

                    <ul className="nav me-auto mb-2 justify-content-center mb-md-0">
                        <li><Link to="/" className="nav-link px-2">Home</Link></li>
                        <li><Link to="/auctions" className="nav-link px-2">Land Auctions</Link></li>
                        <li><Link to="/faq" className="nav-link px-2">FAQ</Link></li>
                        <li><Link to="/docs" className="nav-link px-2">Docs</Link></li>
                        <li><Link to="/explore" className="nav-link px-2">Explore</Link></li>
                    </ul>

                    <Link to="/explore" className="btn btn-cashmere nav-link mb-auto">Explore</Link>
                </div>
            </div>
        </header>
    );
}