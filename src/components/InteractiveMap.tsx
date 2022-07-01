import React, { RefObject, useEffect, useRef } from 'react';
import { MapControlFunctions } from '../world/AppControlFunctions';
import './VirtualSpace.css';
import TezosWalletContext from './TezosWalletContext';
import assert from 'assert';
import { MapPopoverInfo, MarkerMode, WorldMap } from '../world/WorldMap';
import { Button, OverlayTrigger, Popover } from 'react-bootstrap';
import { getiFrameControl } from '../forms/DirectoryForm';
import { useNavigate } from 'react-router-dom';


type InteractiveMapPopupProps = {
    popoverInfo: MapPopoverInfo;
    canvasRef: RefObject<HTMLCanvasElement>;
};

const InteractiveMapPopup: React.FC<InteractiveMapPopupProps> = (props) => {
    const overlay = useRef<HTMLButtonElement>(null);
    const navigate = useNavigate();

    const teleportToMapLocation = () => {
        const iFrameControl = getiFrameControl(window);

        if (iFrameControl) {
            const isLocation = markerMetadata.location.includes("place") || markerMetadata.location.includes("district");

            if (isLocation) iFrameControl.teleportToLocation(markerMetadata.location)
            else iFrameControl.teleportToWorldPos(markerMetadata.mapPosition);
            iFrameControl.closeForm(false);
        }
        else {
            const isPlace = markerMetadata.location.includes("place");

            if (isPlace) navigate(`/explore?placeid=${markerMetadata.id}`);
            else navigate(`/explore?coordx=${markerMetadata.mapPosition[0]}&coordz=${markerMetadata.mapPosition[1]}`);
        }
    }

    useEffect(() => {
        overlay.current?.focus();
    }, [overlay])

    const screenPos = props.popoverInfo.screenPos;
    const markerMetadata = props.popoverInfo.metadata;

    const popover = (
        <Popover>
            <Popover.Body>
                <p>{markerMetadata.description}</p>
                <Button size='sm' onClick={teleportToMapLocation}>Teleport Here</Button>
            </Popover.Body>
        </Popover>
    );

    return <div className='position-absolute' style={{transform: `translate(${screenPos[0]}px, ${screenPos[1]}px)`, lineHeight: '0px'}}>
            <OverlayTrigger
                trigger='focus'
                placement='top'
                delay={{ show: 250, hide: 1 }}
                overlay={popover}>
                <button ref={overlay} className="p-0 m-0 border-0 w-0 h-0"></button>
            </OverlayTrigger>
        </div>
}

type InteractiveMapProps = {
    //mapControl: MapControlFunctions;
    zoom: number;
    threeD: boolean;
    markerMode: MarkerMode;
    markedPlaces?: number[] | undefined;
    placeId?: number;
    className?: string;
};

type InteractiveMapState = {
    mapControl: MapControlFunctions;
    world: WorldMap | null;
    popoverInfo?: any;
};

class InteractiveMap extends React.Component<InteractiveMapProps, InteractiveMapState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;

    private mount = React.createRef<HTMLCanvasElement>();

    public failedToLoad: boolean = false;
    private counter: number = 0;

    constructor(props: InteractiveMapProps) {
        super(props);
        this.state = {
            world: null,
            mapControl: {
                showPopover: (data: MapPopoverInfo) => {
                    if (this.state.popoverInfo !== data)
                        this.setState({popoverInfo: data}, () => this.counter++)
                }
            }
        };
    }

    override componentDidMount() {
        assert(this.mount.current);

        try {
            const worldMap = new WorldMap(this.mount.current, this.props.zoom, this.props.threeD, this.props.markerMode, this.state.mapControl, this.context, this.props.placeId);

            this.setState({world: worldMap}, () => {
                worldMap.loadWorld();
            })
        }
        catch(err: any) {
            this.failedToLoad = true;
            return;
        }
    }

    override componentWillUnmount() {
        this.state.world?.dispose();
    }

    override componentDidUpdate(prevProps: InteractiveMapProps) {
        // add marked places if marked places is now set.
        if (this.props.markedPlaces && !prevProps.markedPlaces) {
            this.state.world?.addMarkedPlaces(this.props.markedPlaces);
        }
      }

    override render() {
        let popover = this.state.popoverInfo && <InteractiveMapPopup canvasRef={this.mount} key={this.counter} popoverInfo={this.state.popoverInfo} />;
          
        return (
            <div className='position-relative'>
                {popover}
                <canvas className={this.props.className} id="renderCanvas" touch-action="none" ref={this.mount} />
            </div>
        )
    }
}

export default InteractiveMap;
