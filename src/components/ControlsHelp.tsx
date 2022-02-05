import React from 'react';

export const ControlsHelp: React.FC<{}> = () => {
    return (
        <div>
            <div className='position-absolute bottom-0 start-0'>
                <button className="btn btn-primary m-3" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasRight" aria-controls="offcanvasRight">Show Control Help</button>
            </div>

            <div className="offcanvas offcanvas-start" tabIndex={-1} id="offcanvasRight" aria-labelledby="offcanvasRightLabel">
                <div className="offcanvas-header">
                    <h4 id="offcanvasRightLabel">Control Help</h4>
                    <button type="button" className="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                </div>
                <div className="offcanvas-body">
                    <p>Keyboard and mouse controls:</p>
                    <p>
                        <span className="glyphicon-stack m-1 mx-0">
                            <i className="bi bi-square-fill glyphicon-stack-1x text-white"></i>
                        </span>
                        <span className="glyphicon-stack m-1 mx-0">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">W</span>
                        </span><br/>
                        <span className="glyphicon-stack m-1 mx-0">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">A</span>
                        </span>
                        <span className="glyphicon-stack m-1 mx-0">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">S</span>
                        </span>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">D</span>
                        </span>
                        Move (arrow keys as well)<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-arrow-up-square-fill glyphicon-stack-1x"></i>
                        </span>
                        Walk (left shift)<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-mouse-fill glyphicon-stack-1x"></i>
                        </span>
                        Look
                    </p>

                    <p>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">I</span>
                        </span>
                        Open inventory<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">M</span>
                        </span>
                        Mint item<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">P</span>
                        </span>
                        Edit Place properties<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">C</span>
                        </span>
                        Clear item selection<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">U</span>
                        </span>
                        Save changes
                    </p>

                    <p>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-half glyphicon-stack-1x" style={{transform: "rotate(180deg)"}}></i>
                        </span>
                        Place item (left mouse)<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-half glyphicon-stack-1x"></i>
                        </span>
                        Get item (right mouse)<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <i className="glyphicon-stack-2x bi-arrow-repeat text-white"></i>
                        </span>
                        Adjust height (mouse wheel)<br/>
                        <span className="glyphicon-stack m-1 mx-0">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">Q</span>
                        </span>/
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">E</span>
                        </span>
                        Rotate item<br/>
                        <span className="glyphicon-stack m-1 mx-0">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">R</span>
                        </span>/
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">F</span>
                        </span>
                        Scale item<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">Del</span>
                        </span>
                        Remove item
                    </p>

                    <p>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">Esc</span>
                        </span>
                        Exit pointer lock
                    </p>
                </div>
            </div>
        </div>
    );
}