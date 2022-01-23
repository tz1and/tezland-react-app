import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTezosWalletContext } from '../components/TezosWalletContext';

type InstructionsProps = {
    closeForm(cancelled: boolean): void;
    loadForm(form_type: string): void;
}

export const Instructions: React.FC<InstructionsProps> = (props) => {
    const context = useTezosWalletContext();
    const nav = useNavigate()

    const button = !context.isWalletConnected() ?
        <button className="btn btn-primary px-3 ms-3 fs-4" onClick={() => context.connectWallet()}>Connect Wallet</button> :
        <button className="btn btn-secondary px-3 ms-3 fs-4" onClick={() => context.disconnectWallet()}>Disonnect Wallet</button>

    const account = context.isWalletConnected() ? <span className='ms-3'>Wallet: {context.walletPHK().substring(0, 12)}...</span> : null;

    return (
        <div className="text-center">
            <div className='position-fixed top-0 start-0 text-white mt-3 ms-3 fs-5'>
                <button className='btn btn-outline-light fs-4' onClick={() => { nav("/"); } }><i className="bi bi-arrow-left"></i></button>
                <button className='btn btn-light ms-3 fs-4' onClick={() => { props.loadForm('settings') } }><i className="bi bi-gear-fill"></i></button>
                {button}
                
                {account}
            </div>
            <div id="explore-instructions" onClick={() => props.closeForm(false)}>
                <p className='text-info App-logo-text'>[tz1aND]</p>
                <p style={{ fontSize: 'calc(20px + 2vmin)' }}>Click to play</p>
                <p>
                    Move: WASD<br />
                    Look: MOUSE<br />
                    Exit: ESCAPE<br />
                </p>
            </div>
            
        </div>
    )
}