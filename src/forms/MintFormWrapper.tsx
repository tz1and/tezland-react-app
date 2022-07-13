import React from 'react';
import { Helmet } from 'react-helmet-async';
import { MintFrom } from './MintForm';


const MintFormWrapper: React.FC<{}> = () => {
    return (
        <div className="container d-flex justify-content-center">
            <Helmet>
                <title>tz1and - Mint</title>
            </Helmet>
            <MintFrom closable={false} closeForm={() => {}} />
        </div>
    );
}

export default MintFormWrapper;