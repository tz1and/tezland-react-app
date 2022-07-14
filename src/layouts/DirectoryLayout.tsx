import { Suspense } from "react";
import { Helmet } from "react-helmet-async";
import { Outlet } from "react-router-dom";
import DirectoryNavigation from '../components/DirectoryNavigation'
import ScrollToTop from "../components/util/ScrollToTop";
import Loading from "../components/util/Loading";

export default function DirectoryLayout() {
    return (
        <ScrollToTop>
            <Helmet>
                <title>tz1and Directory</title>
            </Helmet>
            <DirectoryNavigation />
            <Suspense fallback={<Loading height="80vh" />}>
                <Outlet />
            </Suspense>
        </ScrollToTop>
    );
}