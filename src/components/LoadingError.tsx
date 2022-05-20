import React from "react";
import { Link } from "react-router-dom";

export const LoadingError: React.FC<{}> = () => {
    return <div className="position-fixed top-50 start-50 text-center" style={{transform: "translateY(-50%) translateX(-50%)"}}>
        <img src="/logo_header.png" className='mb-4' style={{height: "calc(20px + 2vmin)"}} alt="tz1and" />
        <div className="bg-danger rounded-3 p-4 text-white row">
            <div className='col-sm-12 col-md-3'>
                <i style={{fontSize: "6rem"}} className="bi bi-exclamation-diamond-fill"></i>
            </div>
            <div className='col-sm-12 col-md-9 my-auto'>
                Oops. Something went really, really wrong.<br/><br/>Maybe your browser doesn't support WebGL or you are one a mobile device?
            </div>
        </div>
        <Link to="/" className="mt-4 d-block link-dark">Back</Link>
    </div>;
}