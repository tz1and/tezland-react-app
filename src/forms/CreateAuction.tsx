import React from 'react';
import {
    Formik,
    Form,
    Field
} from 'formik';
import { MapContainer, ImageOverlay } from 'react-leaflet'
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import BigNumber from 'bignumber.js';
import DutchAuction from '../tz/DutchAuction';
import { useNavigate } from 'react-router-dom';

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

type CreateAuctionFormProps = {}

type CreateAuctionFormState = {
    error: string
}

export const CreateAuctionForm: React.FC<CreateAuctionFormProps> = (props) => {
    const initialValues: CreateAuctionFormValues = { placeId: 0, duration: 48, startPrice: 0, endPrice: 0 };
    const state: CreateAuctionFormState = { error: "" }
    const navigate = useNavigate();

    return (
        <div className="container text-start pt-4">
            <div className='row'>
                <div className='col-lg-2 col-md-0'></div>
                <div className='col-lg-4 col-md-6'>
                    <h2>Create Auction</h2>
                    <Formik
                        initialValues={initialValues}
                        onSubmit={async (values, actions) => {
                            // clear error state
                            state.error = '';
                            //console.log({ values, actions });
                            //alert(JSON.stringify(values, null, 2));

                            try {
                                await DutchAuction.createAuction(new BigNumber(values.placeId), values.startPrice, values.endPrice, values.duration);

                                // navigate to auctions page on success
                                navigate("/auctions", { replace: true });
                            } catch(e: any) {
                                state.error = e.message;
                            }

                            actions.setSubmitting(false);
                        }}
                    >
                        {({
                            /*values,
                            errors,
                            touched,*/
                            isSubmitting
                        }) => { return (
                            <div>
                                {isSubmitting === false && (
                                    <Form>
                                        <div className="mb-3">
                                            <label htmlFor="placeId" className="form-label">Place ID</label>
                                            <Field id="placeId" name="placeId" type="number" className="form-control" aria-describedby="idHelp" />
                                            <div id="idHelp" className="form-text">The id of the place you want to create an auction for. Must be owned.</div>
                                        </div>
                                        <div className="mb-3">
                                            <label htmlFor="duration" className="form-label">Duration (in hours)</label>
                                            <Field id="duration" name="duration" type="number" className="form-control" aria-describedby="durationHelp" />
                                            <div id="durationHelp" className="form-text">Time, in hours, until end price is reached. Auction begins immediately.</div>
                                        </div>
                                        <div className="mb-3">
                                            <label htmlFor="startPrice" className="form-label">Start Price</label>
                                            <div className="input-group mb-3">
                                                <span className="input-group-text">{'\uA729'}</span>
                                                <Field id="startPrice" name="startPrice" type="number" className="form-control" aria-describedby="startPriceHelp" />
                                            </div>
                                            <div id="startPriceHelp" className="form-text">The starting price for the auction. Must be &gt; end price.</div>
                                        </div>
                                        <div className="mb-3">
                                            <label htmlFor="endPrice" className="form-label">End Price</label>
                                            <div className="input-group mb-3">
                                                <span className="input-group-text">{'\uA729'}</span>
                                                <Field id="endPrice" name="endPrice" type="number" className="form-control" aria-describedby="endPriceHelp" />
                                            </div>
                                            <div id="endPriceHelp" className="form-text">The end price for the auction. Must be &lt; starting price.</div>
                                        </div>
                                        <button type="submit" className="btn btn-primary mb-3" disabled={isSubmitting}>Create Auction</button><br/>
                                        {state.error.length > 0 && ( <span className='text-danger'>Transaction failed: {state.error}</span> )}
                                    </Form>
                                )}

                                {isSubmitting === true && (
                                    <div className="text-center">
                                        <div className="spinner-border m-5" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}}
                    </Formik>
                </div>

                <div className='col-lg-4 col-md-6'>
                    <h2>Map Preview</h2>
                    <MapContainer className="mb-2" style={{height: "20rem"}} center={[500, 500]} zoom={1} attributionControl={false} dragging={false} zoomControl={false} scrollWheelZoom={false} crs={L.CRS.Simple} alt="A preview map of the land">
                        <ImageOverlay bounds={[[0, 0], [1000, 1000]]} url="/img/map.svg" />
                    </MapContainer>
                    <small>Note: The the Place will be transferred to the auction contract. Auctions can be cancelled, but please make sure you really intend to create the auction.</small>
                </div>
                <div className='col-lg-2 col-md-0'></div>
            </div>
        </div>
    );
};
