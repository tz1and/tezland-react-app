import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';


type EnterDirectoryPorps = {
    setDirectoryEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}

const EnterDirectory: React.FC<EnterDirectoryPorps> = (props) => {
    const navigate = useNavigate();

    useEffect(() => {
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