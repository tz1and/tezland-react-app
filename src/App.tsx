import React from 'react';
import logo from './logo.svg';
import './App.css';
import VirtualSpace from './3D/VirtualSpace';
import { MintFrom } from './forms/MintForm';
import { PlaceForm } from './forms/PlaceForm';
import { Inventory } from './forms/Inventory';

type AppProps = {
  // using `interface` is also ok
  //message: string;
};
type AppState = {
  show_form: string;
  dispaly_overlay: boolean;
  //count: number; // like this
};

class App extends React.Component<AppProps, AppState> {
  state: AppState = {
    show_form: 'none',
    dispaly_overlay: true
    // optional second annotation for better type inference
    //count: 0,
  };

  private virtualSpaceRef = React.createRef<VirtualSpace>();

  loadForm(form_type: string) {
    this.setState({show_form: form_type, dispaly_overlay: true});
  }

  setOverlayDispaly(display: boolean) {
    this.setState({dispaly_overlay: display});
  }

  closeForm() {
    this.setState({show_form: 'none', dispaly_overlay: false});

    this.virtualSpaceRef.current?.lockControls();
  }

  selectItemFromInventory(id: number) {
    this.setState({show_form: 'none', dispaly_overlay: false});

    const curVS = this.virtualSpaceRef.current;
    if(curVS) {
      curVS.setInventoryItem(id);
      curVS.lockControls();
    }
  }

  render() {
    let closeFormCallback = this.closeForm.bind(this);
    let form;
    if(this.state.show_form === 'none') form = <div id="app-overlay" className="text-center" onClick={closeFormCallback}><img src={logo} className="App-logo" alt="logo" />
        <p style={{fontSize: 'calc(20px + 2vmin)'}}>Click to play</p>
        <p>
          Move: WASD<br/>
          Look: MOUSE<br/>
          Exit: ESCAPE<br/>
        </p>
      </div>
    else if(this.state.show_form === 'mint') form = <MintFrom closeForm={closeFormCallback}/>;
    else if(this.state.show_form === 'place') form = <PlaceForm closeForm={closeFormCallback}/>;
    else if(this.state.show_form === 'inventory') form = <Inventory closeForm={closeFormCallback} selectItemFromInventory={this.selectItemFromInventory.bind(this)}/>;

    let overlay = this.state.dispaly_overlay === false ? null : 
        <header className="App-header">
          {form}
        </header>

//
    return (
      <div className='App'>
        <div className="App-overlay">{overlay}</div>
        <VirtualSpace ref={this.virtualSpaceRef} setOverlayDispaly={this.setOverlayDispaly.bind(this)} loadForm={this.loadForm.bind(this)} />
      </div>
    );
  }
}

export default App;
