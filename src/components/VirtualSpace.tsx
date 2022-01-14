import React from 'react';
import { World } from '../world/World'
import { AppControlFunctions } from '../world/AppControlFunctions';
import './VirtualSpace.css';

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
  state: VirtualSpaceState = {
    // optional second annotation for better type inference
    //count: 0,
    //mount: null
  };

  private mount: HTMLCanvasElement | null;
  private world: World | null;

  constructor(props: VirtualSpaceProps) {
    super(props);
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
    this.world = new World(this.mount!, this.props.appControl);

    (async () => {
      if(!this.world) return;

      await this.world.playerController.setCurrentItem(2);
      await this.world.loadPlace(0);
      await this.world.loadPlace(1);
      await this.world.loadPlace(2);
      await this.world.loadPlace(3);

      const place = this.world.places.get(3);
      if(place) this.world.playerController.setCurrentPlace(place);
    })();
  }

  render() {
    return (
      <div className='VirtualSpace'>
        <canvas id="renderCanvas" touch-action="none" ref={ref => (this.mount = ref)} ></canvas>
        <div id="fps">0</div>
      </div>
    )
  }
}

export default VirtualSpace;
