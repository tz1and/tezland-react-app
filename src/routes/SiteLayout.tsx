import { Outlet } from "react-router-dom";
import Naigation from '../components/Navigation'
import Footer from '../components/Footer'

export default function SiteLayout() {
    return (
        <div>
            <Naigation />
            <Outlet />
            <Footer />
        </div>
    );
}