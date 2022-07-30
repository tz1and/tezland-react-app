import React, { useState } from 'react';
import { OverlayTrigger, Popover } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import SpawnSelectWidget from '../components/SpawnSelectWidget';
import WalletWidget from '../components/WalletWidget';
import { OverlayForm } from '../world/AppControlFunctions';

type InstructionsProps = {
    closeForm: () => void;
    loadForm: (form_type: OverlayForm) => void;
    getCurrentLocation: () => [number, number, number];
    teleportToLocation: (location: string) => void;
    handleFileDrop?: (files: FileList) => void | undefined;
}

export const Instructions: React.FC<InstructionsProps> = (props) => {
    const nav = useNavigate()

    const [dragging, setDragging] = useState(false);

    const copyLocationAddress = () => {
        const pos = props.getCurrentLocation();
        const loc = window.location;
        const address = loc.protocol + '//' + loc.host + loc.pathname + "?coordx=" + pos[0].toFixed(2) + "&coordz=" + pos[2].toFixed(2);
        navigator.clipboard.writeText(address);
    }

    const handleDragEnter = (evt: React.DragEvent<HTMLDivElement>) => {
        evt.preventDefault();
        evt.stopPropagation();
        setDragging(true);
    }

    const handleDragLeave = (evt: React.DragEvent<HTMLDivElement>) => {
        evt.preventDefault();
        evt.stopPropagation();
        setDragging(false);
    }

    const handleDragOver = (evt: React.DragEvent<HTMLDivElement>) => {
        evt.preventDefault();
        evt.stopPropagation();
    }

    const handleDrop = (evt: React.DragEvent<HTMLDivElement>) => {
        evt.preventDefault();
        evt.stopPropagation();
        setDragging(false);

        if (props.handleFileDrop && evt.dataTransfer.files && evt.dataTransfer.files.length > 0) {
            props.handleFileDrop(evt.dataTransfer.files);
            evt.dataTransfer.clearData()
        }
    };

    return (
        <div className="text-center" onDrop={handleDrop} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver}>
            <div className='position-fixed top-0 start-0 text-white mt-3 ms-3'>
                <button className='btn btn-outline-light fs-4' onClick={() => { nav("/"); } }><i className="bi bi-house"></i></button>
                <button className='btn btn-light ms-3 fs-4' onClick={() => { props.loadForm(OverlayForm.Settings) } }><i className="bi bi-gear-fill"></i></button>

                <OverlayTrigger
                    placement={"bottom"}
                    trigger={"focus"}
                    overlay={
                        <Popover>
                            <Popover.Body>
                                Copied current location to clipboard!
                            </Popover.Body>
                        </Popover>
                    }
                >
                    <button className='btn btn-light ms-3 fs-4' onClick={() => { copyLocationAddress(); } }><i className="bi bi-share-fill"></i></button>
                </OverlayTrigger>

                <WalletWidget/>
                <SpawnSelectWidget teleportToLocation={props.teleportToLocation}/>
            </div>
            <div id="explore-instructions" onClick={() => props.closeForm()}>
                {dragging ?
                    <div className='m-5 p-5 border bg-dark text-light rounded-3'><i className="bi bi-file-earmark-arrow-up"></i> Drop file here to preview.</div> :
                    <>
                        <img src="/logo_header.png" className='mb-4' style={{filter: "invert(1)", height: "calc(20px + 8vmin)"}} alt="tz1and" />
                        <p style={{ fontSize: 'calc(20px + 2vmin)' }}>Click to enter</p>
                        <p>
                            Move: WASD<br />
                            Look: MOUSE<br />
                            Exit: ESCAPE<br />
                        </p>
                        <span style={{ fontSize: 'calc(5px + 1vmin)' }}>(You can drop files here to try them before minting.)</span>
                    </>
                }
            </div>
            
        </div>
    )
}