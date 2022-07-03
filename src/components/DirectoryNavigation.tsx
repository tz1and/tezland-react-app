import { Badge, Nav, NavDropdown } from "react-bootstrap";
import { Link, NavLink } from "react-router-dom";
import './Navigation.css';
//import WalletWidget from "./WalletWidget";

export default function DirectoryNavigation() {
    const newBadge = <Badge>New!</Badge>;
    
    return (
        <header className="sticky-top py-3 bg-white text-dark">
            <div className="px-0">
                <div className="d-flex flex-wrap align-items-center justify-content-start">
                    <Link to="/directory/map" className="d-flex align-items-center mb-2 mb-lg-0 text-dark text-decoration-none me-3">
                        <img src="/logo_header.png" alt="tz1and" height="40" /> <h5 className="mb-0">Directory Services</h5>
                    </Link>

                    <Nav className="me-auto mb-2 justify-content-center mb-md-0">
                        <Nav.Link as={NavLink} to="/directory/map" className="nav-link">Map</Nav.Link>

                        <NavDropdown title={<span>Directory {newBadge}</span>} id="basic-nav-dropdown">
                            <NavDropdown.Item as={NavLink} to="/directory/search">Search</NavDropdown.Item>
                            <NavDropdown.Item as={NavLink} to="/directory/new/mints">New Mints</NavDropdown.Item>
                            <NavDropdown.Item as={NavLink} to="/directory/new/swaps">New Swaps</NavDropdown.Item>
                        </NavDropdown>

                        <NavDropdown title={<span>Events {newBadge}</span>} id="basic-nav-dropdown">
                            {/*<NavDropdown.Item as={NavLink} to="/directory/event/1of1July/1of1%20July">1of1 July</NavDropdown.Item>*/}

                            <NavDropdown className="dropdown-submenu" title="1of1 July" id="basic-nav-dropdown">
                                <NavDropdown.Item as={NavLink} to="/directory/event/%231of1/1of1%20July">Places</NavDropdown.Item>
                                <NavDropdown.Item as={NavLink} to="/directory/t/%231of1">Items</NavDropdown.Item>
                            </NavDropdown>

                            {/*<NavDropdown className="dropdown-submenu" title="Tree" id="basic-nav-dropdown">
                                <NavDropdown.Item as={NavLink} to="/directory/event/tree/tree">Places</NavDropdown.Item>
                                <NavDropdown.Item as={NavLink} to="/directory/t/tree">Items</NavDropdown.Item>
                            </NavDropdown>*/}
                        </NavDropdown>
                    </Nav>

                    {/*<WalletWidget/>*/}
                </div>
            </div>
        </header>
    );
}