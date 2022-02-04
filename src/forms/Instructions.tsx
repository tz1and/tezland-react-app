import { Popover } from 'bootstrap';
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import WalletWidget from '../components/WalletWidget';

type InstructionsProps = {
    closeForm(cancelled: boolean): void;
    loadForm(form_type: string): void;
    getCurrentLocation(): [number, number]
}

export const Instructions: React.FC<InstructionsProps> = (props) => {
    const nav = useNavigate()

    const popoverRef = useRef<HTMLButtonElement>(null)
    useEffect(() => {
        if(popoverRef.current) {
            const popover = new Popover(popoverRef.current, {
                content: "Copied curent location!",
                placement: 'bottom',
                trigger: 'focus'
            });

            return () => {
                popover.dispose();
            }
        }

        return;
    })

    const copyLocationAddress = () => {
        const pos = props.getCurrentLocation();
        const loc = window.location;
        const address = loc.protocol + '//' + loc.host + loc.pathname + "?coordx=" + pos[0].toFixed(2) + "&coordz=" + pos[1].toFixed(2);
        navigator.clipboard.writeText(address);
    }

    return (
        <div className="text-center">
            <div className='position-fixed top-0 start-0 text-white mt-3 ms-3'>
                <button className='btn btn-outline-light fs-4' onClick={() => { nav("/"); } }><i className="bi bi-arrow-left"></i></button>
                <button className='btn btn-light ms-3 fs-4' onClick={() => { props.loadForm('settings') } }><i className="bi bi-gear-fill"></i></button>
                <button className='btn btn-light ms-3 fs-4' ref={popoverRef} onClick={() => { copyLocationAddress(); } }><i className="bi bi-share-fill"></i></button>
                <WalletWidget/>
            </div>
            <div id="explore-instructions" onClick={() => props.closeForm(false)}>
                <img src="/logo_header.png" className='mb-4' style={{filter: "invert(1)", height: "calc(20px + 8vmin)"}} alt="tz1and" />
                <p style={{ fontSize: 'calc(20px + 2vmin)' }}>Click to enter</p>
                <p>
                    Move: WASD<br />
                    Look: MOUSE<br />
                    Exit: ESCAPE<br />
                </p>
            </div>
            
        </div>
    )
}