import React, { useState } from 'react';
import {
    Formik,
    Form,
    Field,
    FormikErrors,
    ErrorMessage
} from 'formik';
import Contracts from '../tz/Contracts';
import { useTezosWalletContext } from '../components/TezosWalletContext';
import { Trilean, triHelper } from './FormUtils';
import { char2Bytes, bytes2Char } from "@taquito/utils";
import BasePlaceNode from '../world/nodes/BasePlaceNode';
import assert from 'assert';


interface PlacePropertiesFormValues {
    placeGroundColor: string;
    placeName: string;
}

type PlacePropertiesFormProps = {
    place: BasePlaceNode;
}

type PlacePropertiesFormState = {
    error: string;
    successState: Trilean;
}


const colorToBytes = (color: string) => {
    // remove '/'
    const sliced = color.slice(1);
    return sliced.toLowerCase();
}


export const PlacePropertiesForm: React.FC<PlacePropertiesFormProps> = (props) => {
    const context = useTezosWalletContext();

    const [state, setState] = useState<PlacePropertiesFormState>({error: "", successState: 0});

    assert(props.place.placeData);
    const place_props = props.place.placeData.placeProps;
    const place_color = place_props.get('00');
    const place_name = place_props.get('01');
    
    //const state: PlacePropertiesFormState = { error: "" }
    // 
    const initialValues: PlacePropertiesFormValues = {
        placeGroundColor: place_color ? '#' + place_color : "#bbbbbb",
        placeName: place_name ? bytes2Char(place_name) : ""
    };

    const errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    return (
        <Formik
            initialValues={initialValues}
            validate = {(values) => {
                const errors: FormikErrors<PlacePropertiesFormValues> = {};

                const bytes = colorToBytes(values.placeGroundColor)
                if (bytes.length !== 6 /*|| not hex*/) {
                    errors.placeGroundColor = "Ground color invalid.";
                }

                if (values.placeName.length > 32) {
                    errors.placeName = "Place name is too long (max. 32 characters)."
                }

                // revalidation clears trisate and error
                setState({error: "", successState: 0});
                
                return errors;
            }}
            onSubmit={(values, actions) => {
                Contracts.savePlaceProps(context, colorToBytes(values.placeGroundColor), char2Bytes(values.placeName), props.place, (completed: boolean) => {
                    actions.setSubmitting(false);

                    if (completed)
                        setState({error: "", successState: 1});
                    else
                        setState({error: "Transaction failed", successState: -1});
                }).catch((reason: any) => {
                    actions.setSubmitting(false);
                    setState({error: reason.message, successState: -1});
                });
            }}
        >
            {({
                isSubmitting,
                isValid
            }) => {
                return (
                    <Form>
                        <div className="mb-3">
                            <label htmlFor="placeGroundColor" className="form-label">Place ground color</label>
                            <Field id="placeGroundColor" name="placeGroundColor" type="color" className="form-control" aria-describedby="placeGroundColorHelp" style={{height: "3rem"}} disabled={isSubmitting} autoFocus={true} />
                            <div id="placeGroundColorHelp" className="form-text">You can change the ground color in your place.</div>
                            <ErrorMessage name="placeGroundColor" children={errorDisplay}/>
                        </div>

                        <div className="mb-3">
                            <label htmlFor="placeName" className="form-label">Place Name</label>
                            <Field id="placeName" name="placeName" type="text" className="form-control" aria-describedby="placeNameHelp" disabled={isSubmitting} />
                            <div id="placeNameHelp" className="form-text">The Place's name. Leave empty if you don't want to assign a custom name.</div>
                            <ErrorMessage name="placeName" children={errorDisplay}/>
                        </div>

                        <button type="submit" className={`btn btn-${triHelper(state.successState, "danger", "primary", "success")}`} disabled={isSubmitting || !isValid}>
                            {isSubmitting && (<span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>)} save Place props</button><br/>
                        {state.error && ( <small className='text-danger d-inline-block mt-2'>Saving Place properties failed: {state.error}</small> )}
                    </Form>
                )
            }}
        </Formik>
    );
};
