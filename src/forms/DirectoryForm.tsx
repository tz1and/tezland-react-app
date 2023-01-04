import React from 'react';
import TezosWalletContext from '../components/TezosWalletContext';
import WorldLocation from '../utils/WorldLocation';
import { iFrameControlFunctions } from '../world/AppControlFunctions';


// TODO: this should probably be react state. A context maybe.
export type DirectoryEnabledGlobalState = {
    coords: [number, number];
};

var directoryEnabledGlobal: DirectoryEnabledGlobalState | undefined;

export function setDirectoryEnabledGlobal(state?: DirectoryEnabledGlobalState) {
    directoryEnabledGlobal = state;
}

export function getDirectoryEnabledGlobal(): DirectoryEnabledGlobalState | undefined {
    return directoryEnabledGlobal;
}

export type iFrameControlEvent = {
    tz1andEvent: boolean; // Doesn't matter if true or false, just needs to not be undefined.
    teleportToLocation: WorldLocation;
}

type DirectoryFormProps = {
    iFrameControl: iFrameControlFunctions;
    mapCoords: [number, number];
};

type DirectoryFormState = {

};

export class DirectoryForm extends React.Component<DirectoryFormProps, DirectoryFormState> {
    static override contextType = TezosWalletContext;
    declare context: React.ContextType<typeof TezosWalletContext>;
    
    constructor(props: DirectoryFormProps) {
        super(props);
        this.state = {};
    }

    private onMessageHandler = (event: MessageEvent) => {
        const eventData = event.data;
        if (eventData.tz1andEvent !== undefined) {
            const tz1andEvent = eventData as iFrameControlEvent;
            Object.setPrototypeOf(tz1andEvent.teleportToLocation, WorldLocation.prototype);

            this.props.iFrameControl.teleportToLocation(tz1andEvent.teleportToLocation);

            this.props.iFrameControl.closeForm();
        }
    }

    override componentDidMount() {
        window.addEventListener("message", this.onMessageHandler);
    }

    override componentWillUnmount() {
        window.removeEventListener("message", this.onMessageHandler);
    }

    override render() {
        return (
            <div className='p-1 m-4 mx-auto bg-white bg-gradient border-0 rounded-3 text-dark position-relative' style={{width: "75vw", height: '75vh'}}>
                <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => this.props.iFrameControl.closeForm()}/>
                <iframe className='w-100 h-100' src={`/directory?x=${this.props.mapCoords[0]}&y=${this.props.mapCoords[1]}`} title="tz1and Directory Services"></iframe>
            </div>
        );
    }
}
