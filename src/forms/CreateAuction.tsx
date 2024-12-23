import React from 'react';
import {
    Formik,
    Form,
    Field,
    FormikErrors,
    ErrorMessage
} from 'formik';
import BigNumber from 'bignumber.js';
import DutchAuction from '../tz/DutchAuction';
import Metadata from '../world/Metadata';
import { useNavigate } from 'react-router-dom';
import { fetchUserPlaces } from '../ipfs/graphql';
import TezosWalletContext from '../components/TezosWalletContext';
import { Trilean, triHelper } from './FormUtils';
import { FetchDataPlaceToken, FetchDataResult } from '../components/TokenInfiniteScroll';
import Conf from '../Config';
import { getPlaceType } from "../utils/PlaceKey";
import { WorldMap2D } from '../components/WorldMap2D';
import { assert } from '../utils/Assert';


interface CreateAuctionFormValues {
    /*itemTitle: string;
    itemDescription: string;
    itemTags: string;*/
    placeId: string;
    duration: number;
    startPrice: number;
    endPrice: number;
    //itemFile: ArrayBuffer;
}

type CreateAuctionFormProps = { }

type CreateAuctionFormState = {
    error: string;
    successState: Trilean;
    mapLocation: [number, number];
    placePoly: [number, number][];
    isExteriorPlace: boolean;
    placeInfo: JSX.Element;
    placeInventory: FetchDataResult<FetchDataPlaceToken>[];
}

class CreateAuctionForm extends React.Component<CreateAuctionFormProps, CreateAuctionFormState> {
    private initialValues: CreateAuctionFormValues = { placeId: "-1", duration: 48, startPrice: 2, endPrice: 1 };

    static override contextType = TezosWalletContext;
    declare context: React.ContextType<typeof TezosWalletContext>;

    private navTimeout: NodeJS.Timeout | null = null;

    constructor(props: CreateAuctionFormProps) {
        super(props);
        this.state = {
            error: '',
            successState: 0,
            mapLocation: [1000, 1000],
            placePoly: [],
            isExteriorPlace: true,
            placeInfo: <br/>,
            placeInventory: []
        };
    }

    private panMapToPlace(place_id: number, fa2: string) {
        if(place_id < 0) return;

        // Note: To match leaflet coords, both x and y are flipped and mirrored.
        Metadata.getPlaceMetadata(place_id, fa2).then((res) => {
            assert(res);
            const coords = res.centerCoordinates;
            const center_pos: [number, number] = [1000 + -coords[2], 1000 + -coords[0]];

            const polygon = res.borderCoordinates;
            const placePoly: [number, number][] = []
            for(const pos of polygon)
            {
                placePoly.push([center_pos[0] + -pos[2], center_pos[1] + -pos[0]]);
            }

            const placeInfo = <small>Description: {res.description}<br/>
Build height: {res.buildHeight}<br/>
Place type: {res.placeType}</small>;

            this.setState({ mapLocation: center_pos, placePoly: placePoly, isExteriorPlace: fa2 === Conf.place_contract, placeInfo: placeInfo });
        }, () => {});
    }

    private updatePlacesAndMap() {
        fetchUserPlaces(this.context, [Conf.place_contract, Conf.interior_contract]).then((result) => {
            this.setState({ placeInventory: result }, () => {
                if(this.state.placeInventory.length > 0) {
                    const first = this.state.placeInventory[0];
                    this.panMapToPlace(first.token.tokenId, first.token.contractId);
                    this.initialValues.placeId = this.serialisePlaceId(first.token.contractId, first.token.tokenId);
                }
            });
        })
    }

    onIdChange(e: React.ChangeEvent<any>) {
        try {
            const [placeContract, placeTokenId] = this.parsePlaceId(e.target.value);
            this.panMapToPlace(placeTokenId, placeContract);
        }
        catch(e) {}

    };

    private walletChangeListener = () => {
        this.updatePlacesAndMap();
    }

    override componentDidMount() {
        this.context.walletEvents().addListener("walletChange", this.walletChangeListener);

        this.updatePlacesAndMap();
    }

    override componentWillUnmount() {
        this.context.walletEvents().removeListener("walletChange", this.walletChangeListener);

        if(this.navTimeout) clearTimeout(this.navTimeout);
    }

    private errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    private parsePlaceId(placeId: string): [string, number] {
        const array = placeId.split('#')
        assert(array.length === 2, "PlaceId must be a tuple.");

        const placeTokenId = parseInt(array[1]);
        const placeContract = array[0];

        if (placeTokenId < 0) {
            throw new Error('Place token ID invalid.');
        }

        return [placeContract, placeTokenId];
    }

    private serialisePlaceId(type: string, id: number): string {
        return `${type}#${id}`;
    }

    override render() {
        return (
            <div className="container text-start pt-4">
                <div className='row'>
                    <div className='col-lg-2 col-md-0'></div>
                    <div className='col-lg-4 col-md-6'>
                        <h2>Create Auction</h2>
                        <Formik
                            initialValues={this.initialValues}
                            validate = {async (values) => {
                                const errors: FormikErrors<CreateAuctionFormValues> = {};

                                try {
                                    const [placeContract, placeTokenId] = this.parsePlaceId(values.placeId);
                                    if (await DutchAuction.auctionExists(this.context, placeContract, placeTokenId))
                                        errors.placeId = `Auction for ${getPlaceType(placeContract)} #${placeTokenId} already exists.`;
                                }
                                catch(e: any) {
                                    errors.placeId = e.message;
                                }
            
                                if (values.duration * 3600 <= 60 || values.duration > 720) {
                                    errors.duration = 'Duration must be more than 60s and less than 720h.'
                                }
                              
                                if (!values.startPrice || values.startPrice <= 0) {
                                    errors.startPrice = 'Start price must be > 0.';
                                }
            
                                if (!values.startPrice || !values.endPrice || /*values.endPrice <= 0 ||*/ values.endPrice > values.startPrice) {
                                    errors.endPrice = 'End price must be > 0 and <= start price.';
                                }

                                // revalidation clears trisate and error
                                this.setState({error: "", successState: 0});
                              
                                return errors;
                            }}
                            onSubmit={(values, actions) => {
                                assert(values.startPrice);
                                assert(values.endPrice);

                                const [placeContact, placeTokenId] = this.parsePlaceId(values.placeId);

                                // TODO: IMPORTANT! auction creation needs token contract type
                                DutchAuction.createAuction(this.context, placeContact, new BigNumber(placeTokenId), values.startPrice, values.endPrice, values.duration, (completed: boolean) => {
                                    if (completed) {
                                        this.setState({error: "", successState: 1}, () => {
                                            this.navTimeout = setTimeout(() => {
                                                // @ts-expect-error
                                                this.props.navigate("/auctions", { replace: true })
                                            }, 1000);
                                        });
                                    }
                                    else {
                                        actions.setSubmitting(false);
                                        this.setState({ error: "Transaction failed", successState: -1 });
                                    }
                                }).catch((reason: any) => {
                                    actions.setSubmitting(false);
                                    this.setState({error: reason.message, successState: -1});
                                });
                            }}
                        >
                            {({
                                //values,
                                isValid,
                                isSubmitting,
                                handleChange
                            }) => {
                                // TODO: sort out the drop down mess...

                                return (
                                <Form>
                                    <div className="mb-3">
                                        <label htmlFor="placeId" className="form-label">Place ID</label>
                                        <Field id="placeId" name="placeId" as="select" className="form-select" aria-describedby="idHelp" disabled={isSubmitting} onChange={(e: React.ChangeEvent<any>) => { handleChange(e); this.onIdChange(e); }}>
                                            {!this.state.placeInventory ?
                                                (<option value={"-1"}>Loading Place Inventory...</option>) :
                                                    this.state.placeInventory.length === 0 ?
                                                        (<option value={"-1"}>{this.context.isWalletConnected() ? "No places in inventory." : "Wallet not connected."}</option>) :
                                                            this.state.placeInventory.map((key, index) => (
                                                                // TODO: add descriptiveNameForPlaceToken function.
                                                                <option key={index} value={this.serialisePlaceId(key.token.contractId, key.token.tokenId)}>{key.token.contractId === Conf.place_contract ? 'Place' : 'Interior'} #{key.token.tokenId}</option>
                                                            ))}
                                        </Field>
                                        <div id="idHelp" className="form-text">The id of the place you want to create an auction for. Must be owned.</div>
                                        <ErrorMessage name="placeId" children={this.errorDisplay}/>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Place Info</label><br/>
                                        {this.state.placeInfo}
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="duration" className="form-label">Duration (in hours)</label>
                                        <Field id="duration" name="duration" type="number" className="form-control" aria-describedby="durationHelp" disabled={isSubmitting} />
                                        <div id="durationHelp" className="form-text">Time, in hours, until end price is reached. Auction begins immediately.</div>
                                        <ErrorMessage name="duration" children={this.errorDisplay}/>
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="startPrice" className="form-label">Start Price</label>
                                        <div className="input-group mb-3">
                                            <span className="input-group-text">{'\uA729'}</span>
                                            <Field id="startPrice" name="startPrice" type="number" className="form-control" aria-describedby="startPriceHelp" disabled={isSubmitting} />
                                        </div>
                                        <div id="startPriceHelp" className="form-text">The starting price for the auction. Must be &gt; end price.</div>
                                        <ErrorMessage name="startPrice" children={this.errorDisplay}/>
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="endPrice" className="form-label">End Price</label>
                                        <div className="input-group mb-3">
                                            <span className="input-group-text">{'\uA729'}</span>
                                            <Field id="endPrice" name="endPrice" type="number" className="form-control" aria-describedby="endPriceHelp" disabled={isSubmitting} />
                                        </div>
                                        <div id="endPriceHelp" className="form-text">The end price for the auction. Must be &lt; starting price.</div>
                                        <ErrorMessage name="endPrice" children={this.errorDisplay}/>
                                    </div>
                                    <div className="form-text mb-3">There is a 6% platform fee on successful bids.</div>
                                    <button type="submit" className={`btn btn-${triHelper(this.state.successState, "danger", "primary", "success")} mb-3`} disabled={isSubmitting || !isValid}>
                                        {isSubmitting && <span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>} Create Auction
                                    </button><br/>
                                    {this.state.error && ( <span className='text-danger d-inline-block mt-2'>Create Auction failed: {this.state.error}</span> )}
                                </Form>
                            )}}
                        </Formik>
                    </div>

                    <div className='col-lg-4 col-md-6'>
                        <h2>Map Preview</h2>
                        <WorldMap2D mapClass='rounded mb-2' isExteriorPlace={this.state.isExteriorPlace} style={{height: "20rem", backgroundColor: 'white'}}
                            location={this.state.mapLocation} placePoly={this.state.placePoly} zoomControl={true} scrollWheelZoom={true} dragging={true} />
                        <div className='bg-info bg-info p-3 text-dark rounded small mb-2'>
                            The the Place/Interior <i>will not</i> be transferred to the auction contract on creation. Auctions can be cancelled, but please make sure you really intend to create the auction.<br/>
                            Place ownership transfers on successful bid.
                        </div>
                        <div className='bg-info bg-warning p-3 text-dark rounded small'>
                            If the place you are auctioning has items in it, you will still be able to access them after creating the auction.<br/><b><i>Some Item's ownership will transfer</i> with the place - Items that are added as "place owned".</b>
                        </div>
                    </div>
                    <div className='col-lg-2 col-md-0'></div>
                </div>
            </div>
        );
    }
};

// inject useNavigate with a high order function component.
//https://github.com/remix-run/react-router/issues/8146#issuecomment-947860640
// TODO: move to a helpers module or something
function withNavigation <P>(Component: React.ComponentType<P>): React.FC<P> {
    return props => <Component {...props} navigate={useNavigate()} />;
};

export const CreateAuctionFormW = withNavigation(CreateAuctionForm);