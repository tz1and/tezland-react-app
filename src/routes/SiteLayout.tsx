import { Outlet } from "react-router-dom";
import Naigation from '../components/Navigation'
import Footer from '../components/Footer'
import ScrollToTop from "../components/ScrollToTop";

export default function SiteLayout() {
    return (
        <ScrollToTop>
            <Naigation />
            <Outlet />
            <Footer />
        </ScrollToTop>
    );
}