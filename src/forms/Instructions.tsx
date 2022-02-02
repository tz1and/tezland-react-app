import React from 'react';
import { useNavigate } from 'react-router-dom';
import WalletWidget from '../components/WalletWidget';

type InstructionsProps = {
    closeForm(cancelled: boolean): void;
    loadForm(form_type: string): void;
}

export const Instructions: React.FC<InstructionsProps> = (props) => {
    const nav = useNavigate()

    return (
        <div className="text-center">
            <div className='position-fixed top-0 start-0 text-white mt-3 ms-3'>
                <button className='btn btn-outline-light fs-4' onClick={() => { nav("/"); } }><i className="bi bi-arrow-left"></i></button>
                <button className='btn btn-light ms-3 fs-4' onClick={() => { props.loadForm('settings') } }><i className="bi bi-gear-fill"></i></button>
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