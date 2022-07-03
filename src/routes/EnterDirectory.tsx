import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setDirectoryEnabledGlobal } from '../forms/DirectoryForm';


type EnterDirectoryPorps = {
    setDirectoryEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}

const EnterDirectory: React.FC<EnterDirectoryPorps> = (props) => {
    const navigate = useNavigate();
    const searchParams = useSearchParams()[0];

    const xCoord = searchParams ? parseInt(searchParams.get('x') || '0') : 0;
    const yCoord = searchParams ? parseInt(searchParams.get('y') || '0') : 0;

    useEffect(() => {
        setDirectoryEnabledGlobal({ coords: [xCoord, yCoord] });
        props.setDirectoryEnabled(true);
        navigate("/directory/map", { replace: true });
    });

    return (
        <main>
            You shouldn't be seeing this at all! :D
        </main>
    );
}

export default EnterDirectory;