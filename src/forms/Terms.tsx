import React, { useState } from 'react';
import { ErrorMessage, Field, Form, Formik, FormikErrors } from 'formik';
import { triHelper, Trilean } from './FormUtils';
import { AppTerms } from '../storage';
import { PrivacyStatement, TermsAndConditions } from '../TermsAndPrivacy';
import './Terms.css'

type TermsFormProps = {
    closeForm(): void;
}

type TermsFormState = {
    error: string;
    successState: Trilean;
}

interface TermsFormValues {
    termsAccepted: boolean;
}

export const TermsForm: React.FC<TermsFormProps> = (props) => {
    const [state, setState] = useState<TermsFormState>({error: "", successState: 0});

    const initialValues: TermsFormValues = {
        termsAccepted: false
    };

    const errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    return (
        <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
            <h2>Terms &amp; Conditions</h2>
            <Formik
                initialValues={initialValues}
                validate = {(values) => {
                    const errors: FormikErrors<TermsFormValues> = {};

                    if (!values.termsAccepted) {
                        errors.termsAccepted = "You must agree to the terms.";
                    }

                    // revalidation clears trisate and error
                    setState({error: "", successState: 0});
                    
                    return errors;
                }}
                onSubmit={(values) => {
                    AppTerms.termsAccepted.value = values.termsAccepted;
                    props.closeForm();
                }}
            >
                {({
                    isSubmitting,
                    isValid
                }) => {
                    return (
                        <Form>
                            <div className="mb-3">
                                <div id="termsAndConditions" className='overflow-auto bg-white'>
                                    <h5 className="mb-2">Terms</h5>
                                    {TermsAndConditions}
                                    <h5 className="mb-2">Privacy Policy</h5>
                                    {PrivacyStatement}
                                </div>
                            </div>
                            
                            <div className="mb-3">
                                <Field id="termsAccepted" name="termsAccepted" type="checkbox" className="form-check-input me-2" disabled={isSubmitting}/>
                                <label htmlFor="termsAccepted" className="form-label">I have read the terms and accept</label>
                                <ErrorMessage name="termsAccepted" children={errorDisplay}/>
                            </div>

                            <button type="submit" className={`btn btn-${triHelper(state.successState, "danger", "primary", "success")}`} disabled={isSubmitting || !isValid}>
                                {isSubmitting && (<span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>)} Agree</button><br/>
                            {state.error && ( <small className='text-danger d-inline-block mt-2'>Saving Place properties failed: {state.error}</small> )}
                        </Form>
                    )
                }}
            </Formik>
        </div>
    );
};
