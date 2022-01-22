import React from 'react';
import './Explore.css';
import VirtualSpace from './VirtualSpace';
import { MintFrom } from '../forms/MintForm';
import { PlaceForm } from '../forms/PlaceForm';
import { Inventory } from '../forms/Inventory';
import { Node, Nullable } from '@babylonjs/core';
import { Instructions } from '../forms/Instructions';

type ExploreProps = {
    // using `interface` is also ok
    //message: string;
};
type ExploreState = {
    show_form: string;
    dispaly_overlay: boolean;
    placedItem: Nullable<Node>;
    //count: number; // like this
};

export default class Explore extends React.Component<ExploreProps, ExploreState> {
    private virtualSpaceRef = React.createRef<VirtualSpace>();
    private help: JSX.Element;

    constructor(props: ExploreProps) {
        super(props);
        this.state = {
            show_form: 'instructions',
            dispaly_overlay: true,
            placedItem: null
            // optional second annotation for better type inference
            //count: 0,
        };

        this.help = this.getHelp()
    }

    private getHelp(): JSX.Element {
        return <div>
            <div className='position-absolute bottom-0 start-0'>
                <button className="btn btn-primary m-3" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasRight" aria-controls="offcanvasRight">Show Control Help</button>
            </div>

            <div className="offcanvas offcanvas-start" tabIndex={-1} id="offcanvasRight" aria-labelledby="offcanvasRightLabel">
                <div className="offcanvas-header">
                    <h4 id="offcanvasRightLabel">Control Help</h4>
                    <button type="button" className="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                </div>
                <div className="offcanvas-body">
                    <p>Keyboard and mouse controls:</p>
                    <p>
                        <span className="glyphicon-stack m-1 mx-0">
                            <i className="bi bi-square-fill glyphicon-stack-1x text-white"></i>
                        </span>
                        <span className="glyphicon-stack m-1 mx-0">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">W</span>
                        </span><br/>
                        <span className="glyphicon-stack m-1 mx-0">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">A</span>
                        </span>
                        <span className="glyphicon-stack m-1 mx-0">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">S</span>
                        </span>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">D</span>
                        </span>
                        Move<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-mouse-fill glyphicon-stack-1x"></i>
                        </span>
                        Look
                    </p>

                    <p>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">I</span>
                        </span>
                        Open inventory<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">M</span>
                        </span>
                        Mint item<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">C</span>
                        </span>
                        Clear item selection<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">U</span>
                        </span>
                        Save changes
                    </p>

                    <p>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-half glyphicon-stack-1x" style={{transform: "rotate(180deg)"}}></i>
                        </span>
                        Place item<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-half glyphicon-stack-1x"></i>
                        </span>
                        Get item<br/>
                        <span className="glyphicon-stack m-1 mx-0">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">Q</span>
                        </span>/
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">E</span>
                        </span>
                        Rotate item<br/>
                        <span className="glyphicon-stack m-1 mx-0">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">R</span>
                        </span>/
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">F</span>
                        </span>
                        Scale item<br/>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">Del</span>
                        </span>
                        Remove item
                    </p>

                    <p>
                        <span className="glyphicon-stack m-1 mx-0 me-1">
                            <i className="bi bi-square-fill glyphicon-stack-1x"></i>
                            <span className="glyphicon-stack-2x text-white">Esc</span>
                        </span>
                        Exit pointer lock
                    </p>
                </div>
            </div>
        </div>
    }

    loadForm = (form_type: string) => {
        this.setState({ show_form: form_type, dispaly_overlay: true });
    }

    setOverlayDispaly = (display: boolean) => {
        // Only set state if the overlay state hasn't changed.
        // Avoids form components being called twice.
        if (this.state.dispaly_overlay !== display)
            this.setState({ dispaly_overlay: display });
    }

    placeItem = (node: Node) => {
        this.setState({ show_form: "place", dispaly_overlay: true, placedItem: node });
    }

    closeForm = (cancelled: boolean) => {
        // remove item if action was cancelled.
        if(cancelled && this.state.placedItem) this.state.placedItem.dispose();

        this.setState({ show_form: 'instructions', dispaly_overlay: false, placedItem: null });

        this.virtualSpaceRef.current?.lockControls();
    }

    selectItemFromInventory = (id: number) => {
        this.setState({ show_form: 'instructions', dispaly_overlay: false });

        const curVS = this.virtualSpaceRef.current;
        if (curVS) {
            curVS.setInventoryItem(id);
            curVS.lockControls();
        }
    }

    render() {
        // TODO: probably could use router for overlay/forms.
        let form;
        if (this.state.show_form === 'instructions') form = <Instructions closeForm={this.closeForm} />
        else if (this.state.show_form === 'mint') form = <MintFrom closeForm={this.closeForm} />;
        else if (this.state.show_form === 'place') form = <PlaceForm closeForm={this.closeForm} placedItem={this.state.placedItem} />;
        else if (this.state.show_form === 'inventory') form = <Inventory closeForm={this.closeForm} selectItemFromInventory={this.selectItemFromInventory} />;

        let overlay = !this.state.dispaly_overlay ? null :
            <div className="Explore-overlay">
                {form}
            </div>

        let controlInfo = !this.state.dispaly_overlay ? null : this.help;

        return (
            <div className='Explore'>
                {overlay}
                {controlInfo}
                <VirtualSpace ref={this.virtualSpaceRef} appControl={{
                    setOverlayDispaly: this.setOverlayDispaly,
                    loadForm: this.loadForm,
                    placeItem: this.placeItem
                }} />
            </div>
        );
    }
}
