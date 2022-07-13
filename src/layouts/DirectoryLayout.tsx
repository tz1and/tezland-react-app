import { Helmet } from "react-helmet-async";
import { Outlet } from "react-router-dom";
import DirectoryNavigation from '../components/DirectoryNavigation'
import ScrollToTop from "../components/ScrollToTop";

export default function DirectoryLayout() {
    return (
        <ScrollToTop>
            <Helmet>
                <title>tz1and Directory</title>
            </Helmet>
            <DirectoryNavigation />
            <Outlet />
        </ScrollToTop>
    );
}