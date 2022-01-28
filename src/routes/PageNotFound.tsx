import React from 'react';

export const PageNotFound: React.FC<{}> = () => {
    return (
        <main>
            <div className="px-4 py-5 my-5 text-center">
                <h1 className='mb-4'>[404]</h1>
                <span className='text-muted'>This page does not exist.</span>
            </div>
        </main>
    );
}

export default PageNotFound;