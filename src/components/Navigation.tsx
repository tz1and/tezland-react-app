import { Badge, Nav, NavDropdown } from "react-bootstrap";
import { Link, NavLink } from "react-router-dom";
import './Navigation.css';
import WalletWidget from "./WalletWidget";

export default function Frontpage() {
    const newBadge = <Badge>New!</Badge>;

    return (
        <header className="sticky-top py-3 bg-white text-dark">
            <div className="container px-0">
                <div className="d-flex flex-wrap align-items-center justify-content-start">
                    <Link to="/" className="d-flex align-items-center mb-2 mb-lg-0 text-dark text-decoration-none me-3">
                        <img src="/logo_header.png" alt="tz1and" height="40" />
                    </Link>

                    <Nav className="me-auto mb-2 justify-content-center mb-md-0">

                        <Nav.Link as={NavLink} to="/explore" className="nav-link">Explore</Nav.Link>
                        <Nav.Link as={NavLink} to="/auctions" className="nav-link">Place Auctions</Nav.Link>
                        <Nav.Link as={NavLink} to="/map" className="nav-link">Map</Nav.Link>
                        <Nav.Link as={NavLink} to="/mint" className="nav-link">Mint</Nav.Link>
                        <Nav.Link as={NavLink} to="/tools" className="nav-link">Tools {newBadge}</Nav.Link>

                        <NavDropdown title={<span>Blog {newBadge}</span>} id="blog-nav-dropdown">
                            <NavDropdown.Item as={Link} to="/blog">Blog</NavDropdown.Item>
                            <NavDropdown.Item as={Link} to="/blog/featured">Featured</NavDropdown.Item>
                        </NavDropdown>

                        <NavDropdown title="Events" id="events-nav-dropdown">
                            <NavDropdown className="dropdown-submenu" title="1of1 July" id="1of1-event-nav-dropdown">
                                <NavDropdown.Item as={NavLink} to="/event/%231of1/1of1%20July">Places</NavDropdown.Item>
                                <NavDropdown.Item as={NavLink} to="/t/%231of1">Items</NavDropdown.Item>
                            </NavDropdown>
                        </NavDropdown>
                    </Nav>

                    <WalletWidget/>
                </div>
            </div>
        </header>
    );
}