import TezosWalletContext from "./TezosWalletContext";
import { Popover } from 'bootstrap';
import React from "react";
import { fetchPlaces } from "../ipfs/graphql";
import AppSettings from "../storage/AppSettings";
import assert from "assert";

type SpawnSelectProps = {
    teleportToLocation(location: string): void;
};

type SpawnSelectState = {
    userPlaces: any[];
    currentIsDefault: boolean;
}

export default class SpawnSelectWidget extends React.Component<SpawnSelectProps, SpawnSelectState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;

    private popoverDefaultRef = React.createRef<HTMLButtonElement>();
    private popoverTeleportRef = React.createRef<HTMLButtonElement>();
    private selectRef = React.createRef<HTMLSelectElement>();

    private popoverDefault: Popover | null = null;
    private popoverTeleport: Popover | null = null;

    constructor(props: SpawnSelectProps) {
        super(props);
        this.state = {
            userPlaces: [],
            currentIsDefault: true
        };
    }

    private walletChangeListener = () => {
        // TODO: allow Browser to cache this by setting some max age or something
        fetchPlaces(this.context).then((res) => {
            this.setState({userPlaces: res}, () => {
                assert(this.selectRef.current);
                this.selectRef.current.value = AppSettings.defaultSpawn.value;
            });
        });
    }

    override componentDidMount() {
        this.context.walletEvents().addListener("walletChange", this.walletChangeListener);

        this.walletChangeListener();

        if(this.popoverDefaultRef.current && this.popoverTeleportRef.current) {
            this.popoverDefault = new Popover(this.popoverDefaultRef.current, {
                content: "Set default spawn.",
                placement: 'bottom',
                trigger: 'hover'
            });

            this.popoverTeleport = new Popover(this.popoverTeleportRef.current, {
                content: "Teleport to this location.",
                placement: 'bottom',
                trigger: 'hover'
            });
        }
    }
    
    override componentWillUnmount() {
        this.popoverDefault?.dispose();
        this.popoverTeleport?.dispose();

        this.context.walletEvents().removeListener("walletChange", this.walletChangeListener);
    }

    private setDefaultSpawn = () => {
        assert(this.selectRef.current);

        AppSettings.defaultSpawn.value = this.selectRef.current.value;

        this.setState({currentIsDefault: true});
    }

    private teleportTo = () => {
        assert(this.selectRef.current);

        this.props.teleportToLocation(this.selectRef.current.value);
    }

    private changeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selected = e.target.value;

        this.setState({ currentIsDefault: selected === AppSettings.defaultSpawn.value });
    }

    override render(): React.ReactNode {
        const listElements: JSX.Element[] = []
        for (var place of this.state.userPlaces) {
            listElements.push(<option key={place.tokenId} value={"place" + place.tokenId}>Place #{place.tokenId}</option>);
        }

        // TODO: don't hardcode number of districts, load them from DistrictDefinition.
        return (
            <div className="btn-group" role="group" aria-label="Basic example">
                <button className="btn btn-dark mb-auto ms-3 px-2"><i className="bi bi-bullseye"></i></button>
                <select className="form-select rounded-0" aria-label="Default select example" ref={this.selectRef} defaultValue={AppSettings.defaultSpawn.value} onChange={this.changeSelect}>
                    {listElements}
                    <option key="d1" value="district1">District #1</option>
                    <option key="d2" value="district2">District #2</option>
                    <option key="d3" value="district3">District #3</option>
                    <option key="d4" value="district4">District #4</option>
                    <option key="d5" value="district5">District #5</option>
                    <option key="d6" value="district6">District #6</option>
                    <option key="d7" value="district7">District #7</option>
                    <option key="d8" value="district8">District #8</option>
                    <option key="d9" value="district9">District #9</option>
                    <option key="d10" value="district10">District #10</option>
                </select>
                <button className={`btn btn-${this.state.currentIsDefault ? "success" : "secondary"} mb-auto`} onClick={this.setDefaultSpawn} ref={this.popoverDefaultRef}><i className="bi bi-check2"></i></button>
                <button className="btn btn-light mb-auto" onClick={this.teleportTo} ref={this.popoverTeleportRef}><i className="bi bi-arrow-right"></i></button>
            </div>
        );
    }
}
