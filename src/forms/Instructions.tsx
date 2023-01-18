import React, { useState } from 'react';
import { ButtonGroup, Dropdown, DropdownButton } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import SpawnSelectWidget from '../components/SpawnSelectWidget';
import WalletWidget from '../components/WalletWidget';
import { DirectoryUtils } from '../utils/DirectoryUtils';
import EventBus, { LoadFormEvent } from '../utils/eventbus/EventBus';
import { getPlaceType, PlaceType } from '../utils/PlaceKey';
import WorldLocation from '../utils/WorldLocation';
import { OverlayForm } from '../world/AppControlFunctions';
import BasePlaceNode from '../world/nodes/BasePlaceNode';


type InstructionsProps = {
    currentPlace: BasePlaceNode | null;
    closeForm: () => void;
    getCurrentLocation: () => [number, number, number];
    teleportToLocation: (location: WorldLocation) => void;
    handleFileDrop?: (files: FileList) => void | undefined;
}

enum LinkType {
    PLACE = 0,
    PLACE_POS = 1,
    WORLD_POS = 2
}

export const Instructions: React.FC<InstructionsProps> = (props) => {
    const nav = useNavigate()

    const [dragging, setDragging] = useState(false);

    const copyLocationAddress = (linkType: LinkType) => {
        const pos = props.getCurrentLocation();
        const loc = window.location;

        let explore_url;
        switch(linkType) {
            case LinkType.PLACE:
                explore_url = DirectoryUtils.placeExploreLink(props.currentPlace!.placeKey);
                break;

            case LinkType.PLACE_POS:
                explore_url = DirectoryUtils.placeExploreLink(props.currentPlace!.placeKey) + "&coordx=" + pos[0].toFixed(2) + "&coordy=" + pos[1].toFixed(2) + "&coordz=" + pos[2].toFixed(2);
                break;

            case LinkType.WORLD_POS:
                explore_url = "/explore?coordx=" + pos[0].toFixed(2) + "&coordz=" + pos[2].toFixed(2);
                break;

            default:
                throw new Error(`Unhandled LinkType case: ${linkType}`);
        }

        const address = loc.protocol + '//' + loc.host + explore_url;
        navigator.clipboard.writeText(address);
    }

    const handleDragEnter = (evt: React.DragEvent<HTMLDivElement>) => {
        evt.preventDefault();
        evt.stopPropagation();
        setDragging(true);
    }

    const handleDragLeave = (evt: React.DragEvent<HTMLDivElement>) => {
        evt.preventDefault();
        evt.stopPropagation();
        setDragging(false);
    }

    const handleDragOver = (evt: React.DragEvent<HTMLDivElement>) => {
        evt.preventDefault();
        evt.stopPropagation();
    }

    const handleDrop = (evt: React.DragEvent<HTMLDivElement>) => {
        evt.preventDefault();
        evt.stopPropagation();
        setDragging(false);

        if (props.handleFileDrop && evt.dataTransfer.files && evt.dataTransfer.files.length > 0) {
            props.handleFileDrop(evt.dataTransfer.files);
            evt.dataTransfer.clearData()
        }
    };

    const place_type = props.currentPlace ? getPlaceType(props.currentPlace.placeKey.fa2) : undefined;

    return (
        <div className="text-center" onDrop={handleDrop} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver}>
            <div className='position-fixed top-0 start-0 text-white mt-3 ms-3'>
                <button className='btn btn-outline-light fs-4' onClick={() => { nav("/"); } }><i className="bi bi-house"></i></button>
                <button className='btn btn-light ms-3 fs-4' onClick={() => { EventBus.publish("load-form", new LoadFormEvent(OverlayForm.Settings)) } }><i className="bi bi-gear-fill"></i></button>

                <ButtonGroup>
                    <DropdownButton variant='light' className='ms-3' id="dropdown-basic-button" title={<i className="fs-4 bi bi-share-fill"></i>}>
                        {props.currentPlace && <Dropdown.Item onClick={() => { copyLocationAddress(LinkType.PLACE); } }>Current Place</Dropdown.Item>}
                        {(props.currentPlace && place_type === PlaceType.Interior) && <Dropdown.Item onClick={() => { copyLocationAddress(LinkType.PLACE_POS); } }>Current Place and position</Dropdown.Item>}
                        {(!props.currentPlace || place_type !== PlaceType.Interior) && <Dropdown.Item onClick={() => { copyLocationAddress(LinkType.WORLD_POS); } }>World Position</Dropdown.Item>}
                    </DropdownButton>
                </ButtonGroup>

                <WalletWidget/>
                <SpawnSelectWidget teleportToLocation={props.teleportToLocation}/>
            </div>
            <div id="explore-instructions" onClick={() => props.closeForm()}>
                {dragging ?
                    <div className='m-5 p-5 border bg-dark text-light rounded-3'><i className="bi bi-file-earmark-arrow-up"></i> Drop file here to preview.</div> :
                    <>
                        <img src="/logo_header.png" className='mb-4' style={{filter: "invert(1)", height: "calc(20px + 8vmin)"}} alt="tz1and" />
                        <p style={{ fontSize: 'calc(20px + 2vmin)' }}>Click to enter</p>
                        <p>
                            Move: WASD<br />
                            Look: MOUSE<br />
                            Exit: ESCAPE<br />
                        </p>
                        <span style={{ fontSize: 'calc(5px + 1vmin)' }}>(You can drop files here to try them before minting.)</span>
                    </>
                }
            </div>
            
        </div>
    )
}