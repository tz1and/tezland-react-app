import { Outlet } from "react-router-dom";
import Naigation from '../components/Navigation'
import Footer from '../components/Footer'
import ScrollToTop from "../components/ScrollToTop";
import { Helmet } from "react-helmet-async";

export default function SiteLayout() {
    return (
        <ScrollToTop>
            <Helmet>
                <title>tz1and</title>
            </Helmet>
            <Naigation />
            <Outlet />
            <Footer />
        </ScrollToTop>
    );
}