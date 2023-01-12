import React from "react";
import { Link } from "react-router-dom";

type LoadingErrorProps = {
    errorMsg?: string | undefined;
}

export const LoadingError: React.FC<LoadingErrorProps> = (props) => {
    return <div className="position-fixed top-50 start-50 text-center" style={{transform: "translateY(-50%) translateX(-50%)"}}>
        <img src="/logo_header.png" className='mb-4' style={{height: "calc(20px + 2vmin)"}} alt="tz1and" />
        <div className="bg-danger rounded-3 p-4 text-white row">
            <div className='col-sm-12 col-md-3'>
                <i style={{fontSize: "6rem"}} className="bi bi-exclamation-diamond-fill"></i>
            </div>
            <div className='col-sm-12 col-md-9 my-auto'>
                Oops. Something went really, really wrong.<br/><br/>Maybe your browser doesn't support WebGL or you are on a mobile device?
                {props.errorMsg && <div className="mt-3">
                    There was a message attached, it said:
                    <p className="fw-bold">{props.errorMsg}</p>
                    You could pass it on to someone who knows what it might mean.
                </div>}
            </div>
        </div>
        <Link to="/" className="mt-4 d-block link-dark">Back</Link>
    </div>;
}