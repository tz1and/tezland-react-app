import React, { useEffect } from 'react';
import {
    Formik,
    Form,
    Field,
    FormikErrors
} from 'formik';
import { MapContainer, ImageOverlay, useMap, Circle, Polygon } from 'react-leaflet'
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import BigNumber from 'bignumber.js';
import DutchAuction from '../tz/DutchAuction';
import Metadata from '../world/Metadata';
import { useNavigate } from 'react-router-dom';
import { fetchGraphQL } from '../ipfs/graphql';
import TezosWalletContext from '../components/TezosWalletContext';
import { Logging } from '../utils/Logging';
import assert from 'assert';

type MapSetCenterProps = {
    center: [number, number],
    animate?: boolean
}

// Because react-leaflet is the height of retardation,
// we make a function component that can pan the map.
export const MapSetCenter: React.FC<MapSetCenterProps> = (props) => {
    const parentMap = useMap();

    useEffect(() => {
        parentMap.panTo(props.center, { animate: props.animate });
    });

    return (
        <div></div>
    )
}

interface CreateAuctionFormValues {
    /*itemTitle: string;
    itemDescription: string;
    itemTags: string;*/
    placeId: number;
    duration: number;
    startPrice: number;
    endPrice: number;
    //itemFile: ArrayBuffer;
}

type CreateAuctionFormProps = { }

type CreateAuctionFormState = {
    error: string,
    mapLocation: [number, number],
    placePoly: [number, number][],
    placeInventory?: any[]
}

class CreateAuctionForm extends React.Component<CreateAuctionFormProps, CreateAuctionFormState> {
    private initialValues: CreateAuctionFormValues = { placeId: -1, duration: 48, startPrice: 2, endPrice: 1 };

    static contextType = TezosWalletContext;
    context!: React.ContextType<typeof TezosWalletContext>;
    //declare context: React.ContextType<typeof TezosWalletContext>

    constructor(props: CreateAuctionFormProps) {
        super(props);
        this.state = {
            error: '',
            mapLocation: [500, 500],
            placePoly: []
        };
    }

    private panMapToPlace(place_id: number) {
        if(place_id < 0) return;

        Metadata.getPlaceMetadata(place_id).then((res) => {
            const coords = res.centerCoordinates;
            const center_pos: [number, number] = [500 + -coords[2], 500 + coords[0]];

            const polygon = res.borderCoordinates;
            const placePoly: [number, number][] = []
            for(const pos of polygon)
            {
                placePoly.push([center_pos[0] + -pos[2], center_pos[1] + pos[0]]);
            }

            this.setState({ mapLocation: center_pos, placePoly: placePoly });
        }, () => {});
    }

    private async fetchPlaces() {
        if(!this.context.isWalletConnected()) return [];

        // TODO: hasura limits to 100 results.
        // Maybe need to keep fetching.

        try {
            const data = await fetchGraphQL(`
                query getPlaces($address: String!) {
                    placeTokenHolder(where: {holderId: {_eq: $address}}, order_by: {tokenId: asc}) {
                        tokenId
                    }
                }`, "getPlaces", { address: this.context.walletPHK() });
            
            return data.placeTokenHolder;
        } catch(e: any) {
            Logging.InfoDev("failed to token holder: " + e.message);
            return []
        }
    }

    private updatePlacesAndMap() {
        this.fetchPlaces().then((result) => {
            this.setState({ placeInventory: result });
            if(result.length > 0)
                this.panMapToPlace(result[0].tokenId);
        })
    }

    onIdChange(e: React.ChangeEvent<any>) {
        const place_id = e.target.value;

        this.panMapToPlace(place_id);
    };

    private walletChangeListener = () => {
        this.updatePlacesAndMap();
    }

    componentDidMount() {
        this.context.walletEvents().addListener("walletChange", this.walletChangeListener);

        this.updatePlacesAndMap();
    }

    componentWillUnmount() {
        this.context.walletEvents().removeListener("walletChange", this.walletChangeListener);
    }

    render() {
        return (
            <div className="container text-start pt-4">
                <div className='row'>
                    <div className='col-lg-2 col-md-0'></div>
                    <div className='col-lg-4 col-md-6'>
                        <h2>Create Auction</h2>
                        <Formik
                            initialValues={this.initialValues}
                            validate = {(values) => {
                                const errors: FormikErrors<CreateAuctionFormValues> = {};
            
                                if (values.placeId < 0) {
                                    errors.placeId = 'Place ID invalid.';
                                }
            
                                if (values.duration <= 0 || values.duration > 720) {
                                    errors.duration = 'Duration must be more than 0 and less than 720h.'
                                }
                              
                                if (!values.startPrice || values.startPrice <= 0) {
                                    errors.startPrice = 'Start price must be > 0.';
                                }
            
                                if (!values.startPrice || !values.endPrice || /*values.endPrice <= 0 ||*/ values.endPrice >= values.startPrice) {
                                    errors.endPrice = 'End price must be > 0 and < start price.';
                                }
                              
                                return errors;
                            }}
                            onSubmit={async (values, actions) => {
                                try {
                                    assert(values.startPrice);
                                    assert(values.endPrice);
                                    await DutchAuction.createAuction(this.context, new BigNumber(values.placeId), values.startPrice, values.endPrice, values.duration,
                                        // @ts-expect-error
                                        () => { this.props.navigate("/auctions", { replace: true }) });

                                    return;
                                } catch(e: any) {
                                    this.setState({ error: e.message});
                                }

                                actions.setSubmitting(false);
                            }}
                        >
                            {({
                                //values,
                                isValid,
                                errors,
                                touched,
                                isSubmitting,
                                handleChange
                            }) => {
                                // TODO: sort out the drop down mess...
                                // when only one place is in the inventory, it can't be selected.

                                return (
                                <Form>
                                    <div className="mb-3">
                                        <label htmlFor="placeId" className="form-label">Place ID</label>
                                        <Field id="placeId" name="placeId" as="select" className="form-select" aria-describedby="idHelp" disabled={isSubmitting} onChange={(e: React.ChangeEvent<any>) => { this.onIdChange(e); handleChange(e);}}>
                                            {!this.state.placeInventory ?
                                                (<option value={-1}>Loading Place Inventory...</option>) :
                                                    this.state.placeInventory.length === 0 ?
                                                        (<option value={-1}>{this.context.isWalletConnected() ? "No places in inventory." : "Wallet not conncted."}</option>) :
                                                            this.state.placeInventory.map((key) => (
                                                                <option key={key.tokenId} value={key.tokenId}>Place #{key.tokenId}</option>
                                                            ))}
                                        </Field>
                                        <div id="idHelp" className="form-text">The id of the place you want to create an auction for. Must be owned.</div>
                                        {touched.placeId && errors.placeId && <small className="text-danger">{errors.placeId}</small>}
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="duration" className="form-label">Duration (in hours)</label>
                                        <Field id="duration" name="duration" type="number" className="form-control" aria-describedby="durationHelp" disabled={isSubmitting} />
                                        <div id="durationHelp" className="form-text">Time, in hours, until end price is reached. Auction begins immediately.</div>
                                        {touched.duration && errors.duration && <small className="text-danger">{errors.duration}</small>}
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="startPrice" className="form-label">Start Price</label>
                                        <div className="input-group mb-3">
                                            <span className="input-group-text">{'\uA729'}</span>
                                            <Field id="startPrice" name="startPrice" type="number" className="form-control" aria-describedby="startPriceHelp" disabled={isSubmitting} />
                                        </div>
                                        <div id="startPriceHelp" className="form-text">The starting price for the auction. Must be &gt; end price.</div>
                                        {touched.startPrice && errors.startPrice && <small className="text-danger">{errors.startPrice}</small>}
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="endPrice" className="form-label">End Price</label>
                                        <div className="input-group mb-3">
                                            <span className="input-group-text">{'\uA729'}</span>
                                            <Field id="endPrice" name="endPrice" type="number" className="form-control" aria-describedby="endPriceHelp" disabled={isSubmitting} />
                                        </div>
                                        <div id="endPriceHelp" className="form-text">The end price for the auction. Must be &lt; starting price.</div>
                                        {touched.endPrice && errors.endPrice && <small className="text-danger">{errors.endPrice}</small>}
                                    </div>
                                    <div className="form-text mb-3">There is a 2.5% fee on successful swap.</div>
                                    <button type="submit" className="btn btn-primary mb-3" disabled={isSubmitting || !isValid}>{isSubmitting === true && (<span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>)} Create Auction</button><br/>
                                    {this.state.error.length > 0 && ( <span className='text-danger'>Transaction failed: {this.state.error}</span> )}
                                </Form>
                            )}}
                        </Formik>
                    </div>

                    <div className='col-lg-4 col-md-6'>
                        <h2>Map Preview</h2>
                        <MapContainer className="mb-2" style={{height: "20rem", backgroundColor: 'white'}} center={[500, 500]} zoom={2} attributionControl={false} dragging={true} scrollWheelZoom={false} crs={L.CRS.Simple} alt="A preview map of the Place">
                            <ImageOverlay bounds={[[0, 0], [1000, 1000]]} url="/img/map.svg" />
                            <MapSetCenter center={this.state.mapLocation}/>
                            <Circle center={this.state.mapLocation} radius={1.5} color='#d58195' fillColor='#d58195' fill={true} fillOpacity={1} />
                            <Polygon positions={this.state.placePoly} color='#d58195' weight={10} lineCap='square'/>
                        </MapContainer>
                        <div className='bg-info bg-info p-3 text-dark rounded small mb-2'>The the Place will be transferred to the auction contract. Auctions can be cancelled, but please make sure you really intend to create the auction.</div>
                        <div className='bg-info bg-warning p-3 text-dark rounded small'>If the place you are auctioning has items in it, you will not be able to access them after creating the auction. But their ownership does not transfer with the place.</div>
                    </div>
                    <div className='col-lg-2 col-md-0'></div>
                </div>
            </div>
        );
    }
};

// inject useNavigate with a high order function component.
//https://github.com/remix-run/react-router/issues/8146#issuecomment-947860640
function withNavigation <P>(Component: React.ComponentType<P>): React.FC<P> {
    return props => <Component {...props} navigate={useNavigate()} />;
};

export const CreateAuctionFormW = withNavigation(CreateAuctionForm);