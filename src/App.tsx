import React from 'react';
import './App.css';
import VirtualSpace from './components/VirtualSpace';
import { MintFrom } from './forms/MintForm';
import { PlaceForm } from './forms/PlaceForm';
import { Inventory } from './forms/Inventory';
import { Node, Nullable } from '@babylonjs/core';

type AppProps = {
    // using `interface` is also ok
    //message: string;
};
type AppState = {
    show_form: string;
    dispaly_overlay: boolean;
    placedItem: Nullable<Node>;
    //count: number; // like this
};

class App extends React.Component<AppProps, AppState> {
    state: AppState = {
        show_form: 'none',
        dispaly_overlay: true,
        placedItem: null
        // optional second annotation for better type inference
        //count: 0,
    };

    private virtualSpaceRef = React.createRef<VirtualSpace>();

    loadForm(form_type: string) {
        this.setState({ show_form: form_type, dispaly_overlay: true });
    }

    setOverlayDispaly(display: boolean) {
        // Only set state if the overlay state hasn't changed.
        // Avoids form components being called twice.
        if (this.state.dispaly_overlay !== display)
            this.setState({ dispaly_overlay: display });
    }

    placeItem(node: Node) {
        this.setState({ show_form: "place", dispaly_overlay: true, placedItem: node });
    }

    closeForm(cancelled: boolean) {
        // remove item if action was cancelled.
        if(cancelled && this.state.placedItem) this.state.placedItem.dispose();

        this.setState({ show_form: 'none', dispaly_overlay: false, placedItem: null });

        this.virtualSpaceRef.current?.lockControls();
    }

    selectItemFromInventory(id: number) {
        this.setState({ show_form: 'none', dispaly_overlay: false });

        const curVS = this.virtualSpaceRef.current;
        if (curVS) {
            curVS.setInventoryItem(id);
            curVS.lockControls();
        }
    }

    render() {
        let closeFormCallback = this.closeForm.bind(this);
        let form;
        if (this.state.show_form === 'none') form = <div id="app-overlay" className="text-center" onClick={() => closeFormCallback(true)}>
            <p className='text-info' style={{ fontSize: 'calc(20px + 8vmin)' }}>[tz1aND]</p>
            <p style={{ fontSize: 'calc(20px + 2vmin)' }}>Click to play</p>
            <p>
                Move: WASD<br />
                Look: MOUSE<br />
                Exit: ESCAPE<br />
            </p>
        </div>
        else if (this.state.show_form === 'mint') form = <MintFrom closeForm={closeFormCallback} />;
        else if (this.state.show_form === 'place') form = <PlaceForm closeForm={closeFormCallback} placedItem={this.state.placedItem} />;
        else if (this.state.show_form === 'inventory') form = <Inventory closeForm={closeFormCallback} selectItemFromInventory={this.selectItemFromInventory.bind(this)} />;

        let overlay = this.state.dispaly_overlay === false ? null :
            <header className="App-header">
                {form}
            </header>

        // TODO: probably could use router for overlay/forms.
        return (
            <div className='App'>
                <div className="App-overlay">{overlay}</div>
                <VirtualSpace ref={this.virtualSpaceRef} appControl={{setOverlayDispaly: this.setOverlayDispaly.bind(this), loadForm: this.loadForm.bind(this), placeItem: this.placeItem.bind(this)}} />
            </div>
        );
    }
}

export default App;
