import React from 'react';
import { World } from '../world/World'
import { AppControlFunctions } from '../world/AppControlFunctions';
import './VirtualSpace.css';
import TezosWalletContext from './TezosWalletContext';
import assert from 'assert';
import { Logging } from '../utils/Logging';

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

    getCurrentLocation(): [number, number] {
        assert(this.world);
        const pos = this.world.playerController.getPosition();
        return [pos.x, pos.z];
    }

    lockControls() {
        // Well, it seems requestPointerLock can return a promise.
        // Try to handle it. To not get a top level DOM exception.
        // Sneaky Chrome...
        const promise: unknown = this.mount.current?.requestPointerLock();
        if (promise instanceof Promise) promise.catch((e: DOMException) => { Logging.DirDev(e); })
    }

    componentDidMount() {
        assert(this.mount.current);
        this.world = new World(this.mount.current, this.props.appControl, this.context);
        this.world.loadWorld();
    }

    componentWillUnmount() {
        this.world?.dispose();
        this.world = null;
    }

    render() {
        return (
            <canvas id="renderCanvas" touch-action="none" ref={this.mount} ></canvas>
        )
    }
}

export default VirtualSpace;
