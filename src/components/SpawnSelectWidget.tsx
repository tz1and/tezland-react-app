import TezosWalletContext from "./TezosWalletContext";
import { OverlayTrigger, Popover } from "react-bootstrap";
import React from "react";
import { fetchUserPlaces } from "../ipfs/graphql";
import AppSettings from "../storage/AppSettings";
import { FetchDataPlaceToken, FetchDataResult } from "./TokenInfiniteScroll";
import Conf from "../Config";
import PlaceKey, { getPlaceName } from "../utils/PlaceKey";
import WorldLocation from "../utils/WorldLocation";
import { assert } from "../utils/Assert";


type SpawnSelectProps = {
    teleportToLocation(location: WorldLocation): void;
};

type SpawnSelectState = {
    userPlaces: FetchDataResult<FetchDataPlaceToken>[];
    currentIsDefault: boolean;
}

export default class SpawnSelectWidget extends React.Component<SpawnSelectProps, SpawnSelectState> {
    static override contextType = TezosWalletContext;
    declare context: React.ContextType<typeof TezosWalletContext>;

    private selectRef = React.createRef<HTMLSelectElement>();

    constructor(props: SpawnSelectProps) {
        super(props);
        this.state = {
            userPlaces: [],
            currentIsDefault: true
        };
    }

    private walletChangeListener = () => {
        // TODO: allow Browser to cache this by setting some max age or something
        fetchUserPlaces(this.context, [Conf.place_contract, Conf.interior_contract]).then((res) => {
            this.setState({userPlaces: res}, () => {
                assert(this.selectRef.current);
                this.selectRef.current.value = AppSettings.defaultSpawn.value.toJson();
            });
        });
    }

    override componentDidMount() {
        this.context.walletEvents().addListener("walletChange", this.walletChangeListener);

        this.walletChangeListener();
    }
    
    override componentWillUnmount() {
        this.context.walletEvents().removeListener("walletChange", this.walletChangeListener);
    }

    private setDefaultSpawn = () => {
        assert(this.selectRef.current);

        AppSettings.defaultSpawn.value = PlaceKey.fromJson(this.selectRef.current.value);

        this.setState({currentIsDefault: true});
    }

    private teleportTo = () => {
        assert(this.selectRef.current);

        const placeKey = PlaceKey.fromJson(this.selectRef.current.value);

        if (placeKey.fa2 === "district") this.props.teleportToLocation(new WorldLocation({district: placeKey.id}));
        else this.props.teleportToLocation(new WorldLocation({placeKey: placeKey}));
    }

    private changeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selected = e.target.value;

        this.setState({ currentIsDefault: selected === AppSettings.defaultSpawn.value.toJson() });
    }

    override render(): React.ReactNode {
        const listElements: JSX.Element[] = []
        for (var place of this.state.userPlaces) {
            const placeKey = new PlaceKey(place.token.tokenId, place.token.contractId);
            listElements.push(<option key={placeKey.toString()} value={placeKey.toJson()}>{getPlaceName(placeKey)}</option>);
        }

        // TODO: don't hardcode number of districts, load them from DistrictDefinition.
        return (
            <div className="btn-group" role="group" aria-label="Basic example">
                <button className="btn btn-dark mb-auto ms-3 px-2"><i className="bi bi-bullseye"></i></button>
                <select className="form-select rounded-0" aria-label="Default select example" ref={this.selectRef} defaultValue={AppSettings.defaultSpawn.value.toJson()} onChange={this.changeSelect}>
                    {listElements}
                    <option key="d1" value={new PlaceKey(1, "district").toJson()}>District #1</option>
                    <option key="d2" value={new PlaceKey(2, "district").toJson()}>District #2</option>
                    <option key="d3" value={new PlaceKey(3, "district").toJson()}>District #3</option>
                    <option key="d4" value={new PlaceKey(4, "district").toJson()}>District #4</option>
                    <option key="d5" value={new PlaceKey(5, "district").toJson()}>District #5</option>
                    <option key="d6" value={new PlaceKey(6, "district").toJson()}>District #6</option>
                    <option key="d7" value={new PlaceKey(7, "district").toJson()}>District #7</option>
                    <option key="d8" value={new PlaceKey(8, "district").toJson()}>District #8</option>
                    <option key="d9" value={new PlaceKey(9, "district").toJson()}>District #9</option>
                    <option key="d10" value={new PlaceKey(10, "district").toJson()}>District #10</option>
                </select>
                <OverlayTrigger
                    placement={"bottom"}
                    overlay={
                        <Popover>
                            <Popover.Body>
                                Set default spawn.
                            </Popover.Body>
                        </Popover>
                    }
                >
                    <button className={`btn btn-${this.state.currentIsDefault ? "success" : "secondary"} mb-auto`} onClick={this.setDefaultSpawn}><i className="bi bi-check2"></i></button>
                </OverlayTrigger>
                <OverlayTrigger
                    placement={"bottom"}
                    overlay={
                        <Popover>
                            <Popover.Body>
                                Teleport to this location.
                            </Popover.Body>
                        </Popover>
                    }
                >
                    <button className="btn btn-light mb-auto" onClick={this.teleportTo}><i className="bi bi-arrow-right"></i></button>
                </OverlayTrigger>
            </div>
        );
    }
}
