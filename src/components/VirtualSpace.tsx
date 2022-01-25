import React from 'react';
import { World } from '../world/World'
import { AppControlFunctions } from '../world/AppControlFunctions';
import './VirtualSpace.css';
import TezosWalletContext from './TezosWalletContext';
import assert from 'assert';

type VirtualSpaceProps = {
  appControl: AppControlFunctions;
  // using `interface` is also ok
  //message: string;
};
type VirtualSpaceState = {
  //count: number; // like this
  //mount: HTMLDivElement | null;
};

class VirtualSpace extends React.Component<VirtualSpaceProps, VirtualSpaceState> {
  static contextType = TezosWalletContext;
  context!: React.ContextType<typeof TezosWalletContext>;
  
  private mount = React.createRef<HTMLCanvasElement>();
  private world: World | null;

  constructor(props: VirtualSpaceProps) {
    super(props);
    this.state = {
      // optional second annotation for better type inference
      //count: 0,
      //mount: null
    };
    this.world = null;
  }

  setInventoryItem(id: number) {
    assert(this.world);
    this.world.playerController.setCurrentItem(id);
  }

  lockControls() {
    if(this.mount.current) {
      // request pointer lock.
      this.mount.current.requestPointerLock();
      // focus on canvas for keyboard input to work.
      this.mount.current.focus();
      //this.world?.fpsControls.camControls.lock();
    }
  }

  componentDidMount() {
    if(this.mount.current) {
      this.world = new World(this.mount.current, this.props.appControl, this.context);

      this.world.loadWorld();
    }
  }

  componentWillUnmount() {
    if(this.world) {
      this.world.dispose();
      this.world = null;
    }
  }

  render() {
    return (
      <canvas id="renderCanvas" touch-action="none" ref={this.mount} ></canvas>
    )
  }
}

export default VirtualSpace;
