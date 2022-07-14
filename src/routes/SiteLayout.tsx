import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Naigation from '../components/Navigation'
import Footer from '../components/Footer'
import ScrollToTop from "../components/util/ScrollToTop";
import { Helmet } from "react-helmet-async";
import Loading from "../components/util/Loading";


export default function SiteLayout() {
    return (
        <ScrollToTop>
            <Helmet>
                <title>tz1and</title>
            </Helmet>
            <Naigation />
            <Suspense fallback={<Loading height="80vh" />}>
                <Outlet />
            </Suspense>
            <Footer />
        </ScrollToTop>
    );
}