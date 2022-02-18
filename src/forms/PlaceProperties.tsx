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

interface PlaceFropertiesFormValues {
    placeGroundColor: string;
}

type PlaceFropertiesFormProps = {
    closeForm(cancelled: boolean): void;
    placeId: number;
    placeOwner: string;
    groundColor: string;
}

type PlaceFropertiesFormState = {
    error: string;
    successState: Trilean;
}


const colorToBytes = (color: string) => {
    // remove '/'
    const sliced = color.slice(1);
    return sliced.toLowerCase();
}


export const PlaceFropertiesForm: React.FC<PlaceFropertiesFormProps> = (props) => {
    const context = useTezosWalletContext();

    const [state, setState] = useState<PlaceFropertiesFormState>({error: "", successState: 0});
    
    //const state: PlaceFropertiesFormState = { error: "" }
    const initialValues: PlaceFropertiesFormValues = {
        placeGroundColor: props.groundColor
    };

    const errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    return (
        <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
            <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => props.closeForm(true)} />
            <h2>edit Place props</h2>
            <Formik
                initialValues={initialValues}
                validate = {(values) => {
                    const errors: FormikErrors<PlaceFropertiesFormValues> = {};

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
        </div>
    );
};
