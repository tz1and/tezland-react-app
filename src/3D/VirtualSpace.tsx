import React from 'react';
import VirtualWorld from './VirtualWorld'
import './VirtualSpace.css';

type VirtualSpaceProps = {
  loadForm(form_type: string): void;
  setOverlayDispaly(display: boolean): void;
  // using `interface` is also ok
  //message: string;
};
type VirtualSpaceState = {
  //count: number; // like this
  //mount: HTMLDivElement | null;
};

class VirtualSpace extends React.Component<VirtualSpaceProps, VirtualSpaceState> {
  state: VirtualSpaceState = {
    // optional second annotation for better type inference
    //count: 0,
    //mount: null
  };

  mount: HTMLDivElement | null;

  constructor(props: VirtualSpaceProps) {
    super(props);
    this.mount = null
  }

  componentDidMount() {
    let world = new VirtualWorld(this.mount!, {loadForm: this.props.loadForm, setOverlayDispaly: this.props.setOverlayDispaly});

    world.animate();
  }

  render() {
    return (
      <div className="VirtualSpace" ref={ref => (this.mount = ref)} />
    )
  }
}

export default VirtualSpace;
