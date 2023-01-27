import React from "react";
import { Button } from "react-bootstrap";
import { assert } from "../utils/Assert";
import PlaceKey from "../utils/PlaceKey";
import { signedArea } from "../utils/Utils";
import Metadata from "../world/Metadata";


export type BaseAuctionProps = {
    placeKey: PlaceKey;
    auctionId: number;
    startPrice: number;
    endPrice: number; // im mutez
    startTime: number; // in mutez
    endTime: number;
    owner: string;
    isPrimary: boolean;
    userWhitelisted: boolean;
    finished: boolean;
    finishingBid: number;
    bidOpHash?: string;
}

export type BaseAuctionState = {
    mapLocation: [number, number],
    placePoly: [number, number][],
    placeCoords: [number, number],
    placeArea: number,
    buildHeight: number
}

export abstract class BaseAuction<P, S> extends React.Component<P & BaseAuctionProps, S & BaseAuctionState> {
    protected duration: number;
    protected current_time: number;
    protected started: boolean;
    protected since_start: number;
    protected progress: number;

    constructor(props: P & BaseAuctionProps) {
        super(props);
        this.duration = props.endTime - props.startTime;
        this.current_time = 0;
        this.started = false;
        this.since_start = 0;
        this.progress = 0;

        this.updateTimeVars();
    }

    protected updateTimeVars() {
        this.current_time = Math.floor(Date.now() / 1000);
        this.started = this.current_time >= this.props.startTime;
        this.since_start = Math.min(this.current_time, this.props.endTime) - this.props.startTime;
        this.progress = Math.min(100 - this.since_start / this.duration * 100, 100);
    }

    // returns current price in mutez
    protected calculateCurrentPrice(): number {
        if(this.current_time >= this.props.endTime) return this.props.endPrice;

        const granularity = 60; // seconds
        // From the auction contract code.
        // Always to simulate integer division.
        const duration_g = Math.floor(this.duration / granularity);
        const time_since_start_g = Math.floor(this.since_start / granularity);
        const mutez_per_interval = Math.floor((this.props.startPrice - this.props.endPrice) / duration_g);
        const time_deduction = mutez_per_interval * time_since_start_g;

        const current_price = this.props.startPrice - time_deduction;
        return current_price;
    }

    protected async getPlaceState(): Promise<BaseAuctionState> {
        // Note: To match leaflet coords, both x and y are flipped and mirrored.
        const res = await Metadata.getPlaceMetadata(this.props.placeKey.id, this.props.placeKey.fa2);
        assert(res);
        const coords = res.centerCoordinates;
        const center_pos: [number, number] = [1000 + -coords[2], 1000 + -coords[0]];

        const polygon = res.borderCoordinates;
        const placePoly: [number, number][] = [];
        const areaPoly: number[] = [];
        for(const pos of polygon)
        {
            placePoly.push([center_pos[0] + -pos[2], center_pos[1] + -pos[0]]);
            areaPoly.push(pos[0], pos[2]);
        }

        return {
            mapLocation: center_pos,
            placePoly: placePoly,
            placeCoords: [coords[0], coords[2]],
            placeArea: Math.abs(signedArea(areaPoly, 0, areaPoly.length, 2)),
            buildHeight: res.buildHeight
        };
    }

    protected auctionTypeLabel(className: string = "") {
        if (this.props.isPrimary) return <Button className={className} variant="outline-success" size="sm" disabled={true}>Primary</Button>;
        else return <Button className={className} variant="outline-secondary" size="sm" disabled={true}>Secondary</Button>;
    }
}