import React from 'react';

type InstructionsProps = {
    closeForm(cancelled: boolean): void;
}

export const Instructions: React.FC<InstructionsProps> = (props) => {
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
            <br /><br /><button className='btn btn-primary fs-4 px-4 py-2'>Connect Wallet</button>
        </div>
    )
}