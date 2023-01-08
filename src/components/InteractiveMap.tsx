import React, { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import './VirtualSpace.css';
import { useTezosWalletContext } from './TezosWalletContext';
import { MapPopoverInfo, MarkerMode, WorldMap } from '../world/map/WorldMap';
import { Button, OverlayTrigger, Popover } from 'react-bootstrap';
import { getDirectoryEnabledGlobal, iFrameControlEvent } from '../forms/DirectoryForm';
import { useNavigate } from 'react-router-dom';
import BabylonUtils from '../world/BabylonUtils';
import { Logging } from '../utils/Logging';
import { DirectoryUtils } from '../utils/DirectoryUtils';


type InteractiveMapPopupProps = {
    popoverInfo: MapPopoverInfo;
    canvasRef: RefObject<HTMLCanvasElement>;
};

const InteractiveMapPopup: React.FC<InteractiveMapPopupProps> = (props) => {
    const overlay = useRef<HTMLButtonElement>(null);
    const navigate = useNavigate();

    const teleportToMapLocation = () => {
        if (getDirectoryEnabledGlobal()) {

            window.parent.postMessage({
                tz1andEvent: true,
                teleportToLocation: markerMetadata.location
            } as iFrameControlEvent, "*");
        }
        else {
            if (markerMetadata.location.placeKey)
                navigate(DirectoryUtils.placeExploreLink(markerMetadata.location.placeKey));
            else if (markerMetadata.location.pos)
                navigate(`/explore?coordx=${markerMetadata.location.pos.x}&coordz=${markerMetadata.location.pos.z}`);
            else {
                Logging.Error("Unhandled teleportation location on map", markerMetadata);
            }
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
    location?: [number, number];
    markedPlaces?: number[] | undefined;
    placeId?: number;
    className?: string;
};

const InteractiveMap: React.FC<InteractiveMapProps> = (props) => {
    const context = useTezosWalletContext();

    const mount = useRef<HTMLCanvasElement>(null);

    const [worldMap, setWorldMap] = useState<WorldMap>();
    //const [failedToLoad, setFailedToLoad] = useState(false);
    const [popoverInfo, setPopoverInfo] = useState<MapPopoverInfo>();

    const showPopoverCallback = useCallback((data: MapPopoverInfo) => {
        if (popoverInfo !== data) {
            setPopoverInfo(data);
        }
    }, [popoverInfo])

    useEffect(() => {
        if (!mount.current) return;

        var map: WorldMap | undefined;
        BabylonUtils.createEngine(mount.current).then(engine => {
            try {
                map = new WorldMap(engine, props.zoom, props.threeD, props.markerMode, {showPopover: showPopoverCallback}, context, props.placeId, props.location);

                setWorldMap(map);
                map.loadWorld().catch(e => {});
            }
            catch(err: any) {
                //setFailedToLoad(true);
            }
        }).catch(err => { /*setFailedToLoad(true);*/ });

        return () => {
            // NOTE: we want to destroy the var worldMap that
            // is local to this effect.
            //setWorldMap(undefined);
            map?.dispose();
        }
    // NOTE: there must be a better way to ignore deps than to ignore the lint rule
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mount]); //, context, props.location, props.markerMode, props.placeId, props.threeD, props.zoom, showPopoverCallback, worldMap]);

    useEffect(() => {
        if (props.markedPlaces) {
            worldMap?.addMarkedPlaces(props.markedPlaces);
        }
    }, [props.markedPlaces, worldMap]);

    let popover;
    if (popoverInfo) {
        // Construct key.
        // NOTE: could just be popoverInfo.metadata.location if teleporters had unique ids.
        const stringId = `${popoverInfo.metadata.location}-${popoverInfo.metadata.mapPosition[0]}-${popoverInfo.metadata.mapPosition[1]}`;
        popover = <InteractiveMapPopup canvasRef={mount} key={stringId} popoverInfo={popoverInfo} />;
    }
        
    return (
        <div className='position-relative'>
            {popover}
            <canvas className={props.className} id="renderCanvas" touch-action="none" ref={mount} />
        </div>
    )
}

export default InteractiveMap;
