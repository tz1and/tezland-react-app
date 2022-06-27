import { Outlet } from "react-router-dom";

export const DirectoryFooterPadding = (props: any) => {
    return (
        <div className="pb-5">
            <Outlet />
        </div>
    );
}
