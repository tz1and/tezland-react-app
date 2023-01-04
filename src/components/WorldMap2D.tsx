import map from "../img/map.svg";

import React, { useEffect } from 'react';
import { Circle, ImageOverlay, MapContainer, Polygon, PolygonProps, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';


type MapSetCenterProps = {
    center: L.LatLngExpression,
    animate?: boolean | undefined
}

// Because react-leaflet is the height of retardation,
// we make a function component that can pan the map.
export const MapSetCenter: React.FC<MapSetCenterProps> = (props) => {
    const parentMap = useMap();

    useEffect(() => {
        parentMap.panTo(props.center, { animate: props.animate });
    }, [parentMap, props]);

    return (
        <div></div>
    )
}


type WorldMap2DProps = {
    isExteriorPlace: boolean,
    mapClass: string,
    style: React.CSSProperties,
    location: L.LatLngExpression,
    placePoly: PolygonProps['positions'],
    dragging?: boolean | undefined,
    zoomControl?: boolean | undefined,
    scrollWheelZoom?: boolean | undefined,
    zoom?: number | undefined,
    animate?: boolean | undefined
};

export const WorldMap2D: React.FC<WorldMap2DProps> = (props) => {
    const modifiedMapClass = props.mapClass + (props.isExteriorPlace ? ' map-bg-light' : ' map-bg-dark');

    const placeOutlineColor = props.isExteriorPlace ? '#81a1d5' : '#81d589';
    const placeFillColor = props.isExteriorPlace ? '#81a1d5' : '#81d589';

    return (
        <MapContainer className={modifiedMapClass} style={props.style}
            center={[1000, 1000]} zoom={props.zoom !== undefined ? props.zoom : 2} minZoom={-5} maxZoom={4} attributionControl={false}
            dragging={props.dragging} zoomControl={props.zoomControl} scrollWheelZoom={props.scrollWheelZoom} crs={L.CRS.Simple}
        >
            {props.isExteriorPlace && <ImageOverlay bounds={[[0, 0], [2000, 2000]]} url={map} />}
            <MapSetCenter center={props.location} animate={props.animate}/>
            <Circle center={props.location} radius={1.5} color={placeOutlineColor} fillColor={placeOutlineColor} fill={true} fillOpacity={1} />
            <Polygon positions={props.placePoly} color={placeOutlineColor} fillColor={placeFillColor} fill={true} weight={10} lineCap='square'/>
        </MapContainer>
    );
}
