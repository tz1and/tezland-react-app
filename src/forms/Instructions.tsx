import React from 'react';
import { useTezosWalletContext } from '../components/TezosWalletContext';

type InstructionsProps = {
    closeForm(cancelled: boolean): void;
}

export const Instructions: React.FC<InstructionsProps> = (props) => {
    const context = useTezosWalletContext();

    return (
        <div className="text-center">
            <div id="explore-instructions" onClick={() => props.closeForm(false)}>
                <p className='text-info App-logo-text'>[tz1aND]</p>
                <p style={{ fontSize: 'calc(20px + 2vmin)' }}>Click to play</p>
                <p>
                    Move: WASD<br />
                    Look: MOUSE<br />
                    Exit: ESCAPE<br />
                </p>
            </div>
            { context.isWalletConnected() ?
                <button className="btn btn-secondary mb-auto fs-4 px-4 py-2 mt-5" onClick={() => context.disconnectWallet()}>Disonnect Wallet</button> :
                <button className="btn btn-primary mb-auto fs-4 px-4 py-2 mt-5" onClick={() => context.connectWallet()}>Connect Wallet</button>
            }
        </div>
    )
}