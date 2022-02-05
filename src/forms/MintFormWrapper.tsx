import React from 'react';
import { MintFrom } from './MintForm';

const MintFormWrapper: React.FC<{}> = () => {
    return (
        <div className="container d-flex justify-content-center">
            <MintFrom closable={false} closeForm={() => {}} />
        </div>
    );
}

export default MintFormWrapper;