import React from 'react';
import { Helmet } from 'react-helmet-async';
import { MintCollectionForm } from './MintCollectionForm';


const MintCollectionFormWrapper: React.FC<{}> = () => {
    return (
        <div className="container d-flex justify-content-center">
            <Helmet>
                <title>tz1and - Mint Collection</title>
            </Helmet>
            <MintCollectionForm closable={false} closeForm={() => {}} />
        </div>
    );
}

export default MintCollectionFormWrapper;