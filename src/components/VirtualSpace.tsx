import React from 'react';
import { World } from '../world/World'
import { AppControlFunctions } from '../world/AppControlFunctions';
import './VirtualSpace.css';
import TezosWalletContext from './TezosWalletContext';
import assert from 'assert';
import { Logging } from '../utils/Logging';

type VirtualSpaceProps = {
    appControl: AppControlFunctions;
};
type VirtualSpaceState = {
};

class VirtualSpace extends React.Component<VirtualSpaceProps, VirtualSpaceState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;

    private mount = React.createRef<HTMLCanvasElement>();
    private world: World | null;

    public failedToLoad: boolean = false;

    constructor(props: VirtualSpaceProps) {
        super(props);
        this.state = {};
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

    override componentDidMount() {
        assert(this.mount.current);
        try {
            this.world = new World(this.mount.current, this.props.appControl, this.context);
        }
        catch(err: any) {
            this.failedToLoad = true;
            return;
        }

        this.world.loadWorld();
    }

    override componentWillUnmount() {
        this.world?.dispose();
        this.world = null;
    }

    override render() {
        return (
            <canvas id="renderCanvas" touch-action="none" ref={this.mount} ></canvas>
        )
    }
}

export default VirtualSpace;
