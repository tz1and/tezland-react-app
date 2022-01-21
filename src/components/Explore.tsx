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

    constructor(props: ExploreProps) {
        super(props);
        this.state = {
            show_form: 'instructions',
            dispaly_overlay: true,
            placedItem: null
            // optional second annotation for better type inference
            //count: 0,
        };
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

        let overlay = this.state.dispaly_overlay === false ? null :
            <div className="Explore-overlay">
                {form}
            </div>

        return (
            <div className='Explore'>
                {overlay}
                <VirtualSpace ref={this.virtualSpaceRef} appControl={{
                    setOverlayDispaly: this.setOverlayDispaly,
                    loadForm: this.loadForm,
                    placeItem: this.placeItem
                }} />
            </div>
        );
    }
}
