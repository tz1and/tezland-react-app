import { Outlet } from "react-router-dom";
import DirectoryNavigation from '../components/DirectoryNavigation'
import ScrollToTop from "../components/ScrollToTop";

export default function DirectoryLayout() {
    return (
        <ScrollToTop>
            <DirectoryNavigation />
            <Outlet />
        </ScrollToTop>
    );
}