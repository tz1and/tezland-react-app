import React, { useState } from 'react';
import {
    Formik,
    Form,
    Field,
    FormikErrors,
    ErrorMessage
} from 'formik';
import Contracts from '../tz/Contracts';
import { validateAddress, ValidationResult } from '@taquito/utils';
import { useTezosWalletContext } from '../components/TezosWalletContext';
import { Trilean, triHelper } from './FormUtils';
import Place from '../world/PlaceNode';

interface PlaceRemovePermissionsFormValues {
    permissionsTo: string;
}

type PlaceRemovePermissionsFormProps = {
    place: Place;
}

type PlaceRemovePermissionsFormState = {
    error: string;
    successState: Trilean;
}


export const PlaceRemovePermissionsForm: React.FC<PlaceRemovePermissionsFormProps> = (props) => {
    const context = useTezosWalletContext();

    const [state, setState] = useState<PlaceRemovePermissionsFormState>({error: "", successState: 0});
    
    //const state: PlaceRemovePermissionsFormState = { error: "" }
    const initialValues: PlaceRemovePermissionsFormValues = {
        permissionsTo: ""
    };

    const errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    return (
        <Formik
            initialValues={initialValues}
            validate = {(values) => {
                const errors: FormikErrors<PlaceRemovePermissionsFormValues> = {};

                if (validateAddress(values.permissionsTo) !== ValidationResult.VALID) {
                    errors.permissionsTo = "Address invalid.";
                }

                // revalidation clears trisate and error
                setState({error: "", successState: 0});
                
                return errors;
            }}
            onSubmit={(values, actions) => {
                Contracts.removePlacePermissions(context, props.place.currentOwner, props.place.placeId, values.permissionsTo, (completed: boolean) => {
                    actions.setSubmitting(false);

                    if (completed) {
                        setState({error: "", successState: 1});
                        actions.resetForm();
                    } else
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
                            <label htmlFor="permissionsTo" className="form-label">Permittee</label>
                            <Field id="permissionsTo" name="permissionsTo" type="text" className="form-control" aria-describedby="permissionsToHelp" disabled={isSubmitting} />
                            <div id="permissionsToHelp" className="form-text">The address you want to remove permissions from.</div>
                            <ErrorMessage name="permissionsTo" children={errorDisplay}/>
                        </div>
                        
                        <button type="submit" className={`btn btn-${triHelper(state.successState, "danger", "primary", "success")}`} disabled={isSubmitting || !isValid}>
                            {isSubmitting && (<span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>)} remove Permissions</button><br/>
                        {state.error && ( <small className='text-danger d-inline-block mt-2'>Remove Place permissions failed: {state.error}</small> )}
                    </Form>
                )
            }}
        </Formik>
    );
};
