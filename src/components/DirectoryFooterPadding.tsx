import { Outlet } from "react-router-dom";

export const DirectoryFooterPadding = () => {
    return (
        <div className="pb-5">
            <Outlet />
        </div>
    );
}
