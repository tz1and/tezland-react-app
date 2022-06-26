import React, { createRef } from 'react';
import TezosWalletContext from '../components/TezosWalletContext';
import { iFrameControlFunctions } from '../world/AppControlFunctions';
import assert from 'assert';

function setiFrameControl(iframe: HTMLIFrameElement, dwa: iFrameControlFunctions) {
    assert(iframe.contentWindow);

    // @ts-expect-error
    iframe.contentWindow.directoryWorldAccess = dwa;
}

export function getiFrameControl(theWindow: Window): iFrameControlFunctions | undefined {
    // @ts-expect-error
    return theWindow.directoryWorldAccess;
}

type DirectoryFormProps = {
    iFrameControl: iFrameControlFunctions;
};

type DirectoryFormState = {

};

export class DirectoryForm extends React.Component<DirectoryFormProps, DirectoryFormState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;

    private iframeRef = createRef<HTMLIFrameElement>();
    
    constructor(props: DirectoryFormProps) {
        super(props);
        this.state = {};
    }

    override componentDidMount() {
        if (this.iframeRef.current) {
            //setiFrameControl(this.iframeRef.current, this.props.iFrameControl);

            this.iframeRef.current.onload = () => {
                assert(this.iframeRef.current);
                setiFrameControl(this.iframeRef.current, this.props.iFrameControl);
            }
        }
    }

    override render() {
        return (
            <div className='p-1 m-4 mx-auto bg-white bg-gradient border-0 rounded-3 text-dark position-relative' style={{width: "75vw", height: '75vh'}}>
                <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => this.props.iFrameControl.closeForm(true)}/>
                <iframe className='w-100 h-100' src="/directory/map" title="tz1and Directory Services" ref={this.iframeRef}></iframe>
            </div>
        );
    }
}
