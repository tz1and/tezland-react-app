import React from 'react';
import { AppControlFunctions } from '../world/AppControlFunctions';
import './VirtualSpace.css';
import TezosWalletContext from './TezosWalletContext';
import assert from 'assert';
import { Logging } from '../utils/Logging';
import { Vector3 } from '@babylonjs/core';
import BabylonUtils from '../world/BabylonUtils';
import { Game } from '../world/Game';
import TokenKey from '../utils/TokenKey';
import Contracts from '../tz/Contracts';


type VirtualSpaceProps = {
    appControl: AppControlFunctions;
    errorCallback: (e: any) => void;
};

type VirtualSpaceState = {
    game: Game | null;
};

class VirtualSpace extends React.Component<VirtualSpaceProps, VirtualSpaceState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;

    private mount = React.createRef<HTMLCanvasElement>();

    constructor(props: VirtualSpaceProps) {
        super(props);
        this.state = { game: null };
    }

    setInventoryItem(tokenKey: TokenKey, quantity: number) {
        assert(this.state.game);
        this.state.game.playerController.selectItemForPlacement(tokenKey, quantity);
    }

    getCurrentLocation(): [number, number, number] {
        assert(this.state.game);
        const pos = this.state.game.playerController.getPosition();
        return [pos.x, pos.y, pos.z];
    }

    teleportToLocation(location: string) {
        assert(this.state.game);
        this.state.game.playerController.teleportToLocation(location);
    }

    teleportToWorldPos(pos: [number, number]) {
        assert(this.state.game);
        this.state.game.playerController.teleportToWorldPos(new Vector3(pos[0], 0, pos[1]));
    }

    handleDroppedFile(file: File) {
        assert(this.state.game);
        this.state.game.playerController.handleDroppedFile(file);
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

        const mobileCheck = function() {
            let check = false;
            // @ts-expect-error
            // eslint-disable-next-line no-useless-escape
            (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
            return check;
        };

        if (mobileCheck() === true) {
            this.props.errorCallback(new Error("tz1and is currently not available on mobile devices."));
            return;
        }

        BabylonUtils.createEngine(this.mount.current).then(async (engine) => {
            try {
                await Contracts.getWorldAllowedPlaceTokens(this.context);
                this.setState({game: new Game(engine, this.props.appControl, this.context)});
            }
            catch(err: any) {
                this.props.errorCallback(err);
            }
        }).catch(err => this.props.errorCallback(err));
    }

    override componentWillUnmount() {
        this.state.game?.dispose();
    }

    override render() {
        return (
            <canvas id="renderCanvas" touch-action="none" ref={this.mount} ></canvas>
        )
    }
}

export default VirtualSpace;
