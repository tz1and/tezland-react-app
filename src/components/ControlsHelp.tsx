import React from 'react';

// eslint-disable-next-line import/no-webpack-loader-syntax
import l_shift from "!file-loader!../img/keys/l_shift.svg"; // Temp workaround for CRA5
// eslint-disable-next-line import/no-webpack-loader-syntax
import mouse_move from "!file-loader!../img/keys/mouse_move.svg"; // Temp workaround for CRA5
// eslint-disable-next-line import/no-webpack-loader-syntax
import mouse_wheel from "!file-loader!../img/keys/mouse_wheel.svg"; // Temp workaround for CRA5
// eslint-disable-next-line import/no-webpack-loader-syntax
import mouse_left from "!file-loader!../img/keys/mouse_left.svg"; // Temp workaround for CRA5
// eslint-disable-next-line import/no-webpack-loader-syntax
import mouse_right from "!file-loader!../img/keys/mouse_right.svg"; // Temp workaround for CRA5
// eslint-disable-next-line import/no-webpack-loader-syntax
import scale_down from "!file-loader!../img/keys/scale_down.svg"; // Temp workaround for CRA5
// eslint-disable-next-line import/no-webpack-loader-syntax
import scale_up from "!file-loader!../img/keys/scale_up.svg"; // Temp workaround for CRA5
// eslint-disable-next-line import/no-webpack-loader-syntax
import space_bar from "!file-loader!../img/keys/space_bar.svg"; // Temp workaround for CRA5

export const ControlsHelp: React.FC<{}> = () => {

    const key_icon = (icon: string | JSX.Element) => {
        return <span className="glyphicon-stack m-1 mx-0 me-1">
            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
            <span className="glyphicon-stack-2x text-white">{icon}</span>
        </span>
    }

    return (
        <div>
            <div className='position-absolute bottom-0 start-0'>
                <button className="btn btn-primary m-3" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasRight" aria-controls="offcanvasRight">Show Controls Help</button>
            </div>

            <div className="offcanvas offcanvas-start" tabIndex={-1} id="offcanvasRight" aria-labelledby="offcanvasRightLabel">
                <div className="offcanvas-header">
                    <h4 id="offcanvasRightLabel">Controls Help</h4>
                    <button type="button" className="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                </div>
                <div className="offcanvas-body">
                    {/*<p>Keyboard and mouse controls:</p>*/}
                    <p>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x text-white"></i>
                        </span>
                        {key_icon("W")}<br/>
                        {key_icon("A")}
                        {key_icon("S")}
                        {key_icon("D")}
                        Move (arrow keys as well)<br/>
                        <img src={l_shift} className='glyphicon m-1 mx-0 me-1' alt=""/>
                        Walk (left shift)<br/>
                        <img src={space_bar} className='glyphicon m-1 mx-0 me-1' alt=""/>
                        Jump (space bar)<br/>
                        {key_icon("G")}
                        Toggle Fly-mode<br/>
                        <img src={mouse_move} className='glyphicon m-1 mx-0 me-1' alt=""/>
                        Look<br/>
                        {key_icon("X")}
                        Unglitch me
                    </p>

                    <p>
                        {key_icon("I")}
                        Open inventory<br/>
                        {key_icon("M")}
                        Mint item<br/>
                        {key_icon("P")}
                        Edit Place properties<br/>
                        {key_icon("C")}
                        Clear item selection<br/>
                        {key_icon("U")}
                        Save changes
                    </p>

                    <p>
                        <img src={mouse_left} className='glyphicon m-1 mx-0 me-1' alt=""/>
                        Place item (left mouse)<br/>
                        <img src={mouse_right} className='glyphicon m-1 mx-0 me-1' alt=""/>
                        Get item (right mouse)<br/>
                        <img src={mouse_wheel} className='glyphicon m-1 mx-0 me-1' alt=""/>
                        Adjust height (mouse wheel)<br/>
                        {key_icon("1")}/{key_icon("2")}
                        Rotate Item around Y (up)<br/>
                        {key_icon("3")}/{key_icon("4")}
                        Rotate Item around Z (forward)<br/>
                        {key_icon("5")}/{key_icon("6")}
                        Rotate Item around X (right)<br/>
                        {key_icon("R")}/{key_icon("F")}
                        Scale item<br/>
                        {key_icon("Del")}
                        Remove item
                    </p>

                    <p>
                        {key_icon("F10")}
                        Take screenshot<br/>
                        {key_icon("Esc")}
                        Exit pointer lock
                    </p>
                </div>
            </div>
        </div>
    );
}