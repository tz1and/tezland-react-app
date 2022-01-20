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
}

// TODO: fetch owned places from landex and make a dropdown of places.

class CreateAuctionForm extends React.Component<CreateAuctionFormProps, CreateAuctionFormState> {
    private initialValues: CreateAuctionFormValues = { placeId: 0, duration: 48, startPrice: 0, endPrice: 0 };

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
            const coords = res.token_info.center_coordinates;
            const center_pos: [number, number] = [500 + -coords[2], 500 + coords[0]];

            const polygon = res.token_info.border_coordinates;
            const placePoly: [number, number][] = []
            for(const pos of polygon)
            {
                placePoly.push([center_pos[0] + -pos[2], center_pos[1] + pos[0]]);
            }

            this.setState({ mapLocation: center_pos, placePoly: placePoly });
        })
    }

    onIdChange(e: React.ChangeEvent<any>) {
        const place_id = e.target.value;

        this.panMapToPlace(place_id);
    };

    componentDidMount() {
        this.panMapToPlace(0);
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
                              
                                if (values.startPrice <= 0) {
                                    errors.startPrice = 'Start price must be > 0.';
                                }
            
                                if (values.endPrice <= 0 || values.endPrice >= values.startPrice) {
                                    errors.endPrice = 'End price must be > 0 and < start price.';
                                }
                              
                                return errors;
                            }}
                            onSubmit={async (values, actions) => {
                                try {
                                    await DutchAuction.createAuction(new BigNumber(values.placeId), values.startPrice, values.endPrice, values.duration);

                                    // navigate to auctions page on success
                                    // @ts-expect-error
                                    this.props.navigate("/auctions", { replace: true });

                                    return;
                                } catch(e: any) {
                                    this.setState({ error: e.message});
                                }

                                // clear error state TODO: needed?
                                //this.setState({ error: ''});

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
                            }) => { return (
                                <Form>
                                    <div className="mb-3">
                                        <label htmlFor="placeId" className="form-label">Place ID</label>
                                        <Field id="placeId" name="placeId" type="number" className="form-control" aria-describedby="idHelp" disabled={isSubmitting} onChange={(e: React.ChangeEvent<any>) => { this.onIdChange(e); handleChange(e);}}/>
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
                        <MapContainer className="mb-2" style={{height: "20rem", backgroundColor: 'white'}} center={[500, 500]} zoom={2} attributionControl={false} dragging={false} scrollWheelZoom={false} crs={L.CRS.Simple} alt="A preview map of the land">
                            <ImageOverlay bounds={[[0, 0], [1000, 1000]]} url="/img/map.svg" />
                            <MapSetCenter center={this.state.mapLocation}/>
                            <Circle center={this.state.mapLocation} radius={1.5} color='#d58195' fillColor='#d58195' fill={true} fillOpacity={1} />
                            <Polygon positions={this.state.placePoly} color='#d58195' weight={10} lineCap='square'/>
                        </MapContainer>
                        <small>Note: The the Place will be transferred to the auction contract. Auctions can be cancelled, but please make sure you really intend to create the auction.</small>
                    </div>
                    <div className='col-lg-2 col-md-0'></div>
                </div>
            </div>
        );
    }
};


// TODO: figure out how to properly to HOC in typescript.
//https://github.com/remix-run/react-router/issues/8146#issuecomment-947860640
// @ts-expect-error
function withNavigation(Component) {
    // @ts-expect-error
    return props => <Component {...props} navigate={useNavigate()} />;
}

export const CreateAuctionFormW = withNavigation(CreateAuctionForm);