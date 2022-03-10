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

interface PlacePropertiesFormValues {
    placeGroundColor: string;
}

type PlacePropertiesFormProps = {
    placeId: number;
    placeOwner: string;
    groundColor: string;
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
    
    //const state: PlacePropertiesFormState = { error: "" }
    const initialValues: PlacePropertiesFormValues = {
        placeGroundColor: props.groundColor
    };

    const errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    return (
        <Formik
            initialValues={initialValues}
            validate = {(values) => {
                const errors: FormikErrors<PlacePropertiesFormValues> = {};

                const bytes = colorToBytes(values.placeGroundColor)
                if(bytes.length !== 6 /*|| not hex*/) {
                    errors.placeGroundColor = "Ground color invalid.";
                }

                // revalidation clears trisate and error
                setState({error: "", successState: 0});
                
                return errors;
            }}
            onSubmit={(values, actions) => {
                Contracts.savePlaceProps(context, colorToBytes(values.placeGroundColor), props.placeId, props.placeOwner, (completed: boolean) => {
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
                                
                        <button type="submit" className={`btn btn-${triHelper(state.successState, "danger", "primary", "success")}`} disabled={isSubmitting || !isValid}>
                            {isSubmitting && (<span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>)} save Place props</button><br/>
                        {state.error && ( <small className='text-danger d-inline-block mt-2'>Saving Place properties failed: {state.error}</small> )}
                    </Form>
                )
            }}
        </Formik>
    );
};
