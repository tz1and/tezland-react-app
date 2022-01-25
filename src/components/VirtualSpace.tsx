import React from 'react';
import { World } from '../world/World'
import { AppControlFunctions } from '../world/AppControlFunctions';
import './VirtualSpace.css';
import TezosWalletContext from './TezosWalletContext';

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
  
  private mount: HTMLCanvasElement | null;
  private world: World | null;

  constructor(props: VirtualSpaceProps) {
    super(props);
    this.state = {
      // optional second annotation for better type inference
      //count: 0,
      //mount: null
    };
    this.mount = null
    this.world = null;
  }

  setInventoryItem(id: number) {
    this.world?.playerController.setCurrentItem(id);
  }

  lockControls() {
    // request pointer lock.
    this.mount?.requestPointerLock();
    // focus on canvas for keyboard input to work.
    this.mount?.focus();
    //this.world?.fpsControls.camControls.lock();
  }

  componentDidMount() {
    this.world = new World(this.mount!, this.props.appControl, this.context);

    this.world.loadWorld();
  }

  componentWillUnmount() {
    if(this.world) {
      this.world.destroy();
      this.world = null;
    }
  }

  render() {
    return (
      <canvas id="renderCanvas" touch-action="none" ref={ref => (this.mount = ref)} ></canvas>
    )
  }
}

export default VirtualSpace;
