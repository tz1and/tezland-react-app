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

interface PlaceAddPermissionsFormValues {
    permissionsTo: string;

    permissionPlaceItems: boolean;
    permissionModifyAll: boolean;
    permissionProps: boolean;
    permissionCanSell: boolean;
    permissionFull: boolean;
}

type PlaceAddPermissionsFormProps = {
    place: Place;
}

type PlaceAddPermissionsFormState = {
    error: string;
    successState: Trilean;
}


export const PlaceAddPermissionsForm: React.FC<PlaceAddPermissionsFormProps> = (props) => {
    const context = useTezosWalletContext();

    const [state, setState] = useState<PlaceAddPermissionsFormState>({error: "", successState: 0});
    
    //const state: PlaceAddPermissionsFormState = { error: "" }
    const initialValues: PlaceAddPermissionsFormValues = {
        permissionsTo: "",
        permissionPlaceItems: false,
        permissionModifyAll: false,
        permissionProps: false,
        permissionCanSell: false,
        permissionFull: false
    };

    const errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    const onFullPermissionsChange = (e: React.ChangeEvent<any>, setFieldValue: (field: string, value: any, shouldValidate?: boolean) => void) => {
        if (e.target.checked === true) {
            setFieldValue("permissionPlaceItems", true);
            setFieldValue("permissionModifyAll", true);
            setFieldValue("permissionProps", true);
            setFieldValue("permissionCanSell", true);
        }
    };

    return (
        <Formik
            initialValues={initialValues}
            validate = {(values) => {
                const errors: FormikErrors<PlaceAddPermissionsFormValues> = {};

                if (validateAddress(values.permissionsTo) !== ValidationResult.VALID) {
                    errors.permissionsTo = "Address invalid.";
                }

                // revalidation clears trisate and error
                setState({error: "", successState: 0});
                
                return errors;
            }}
            onSubmit={(values, actions) => {
                let permissions = 0;
                if (values.permissionFull)
                    permissions = 7;
                else {
                    const permPlaceItems = 1;
                    const permModifyAll  = 2;
                    const permProps      = 4;
                    //const permCanSell    = 8;
                    if (values.permissionPlaceItems) permissions |= permPlaceItems;
                    if (values.permissionModifyAll) permissions |= permModifyAll;
                    if (values.permissionProps) permissions |= permProps;
                    //if (values.permissionCanSell) permissions |= permCanSell;
                }
                
                Contracts.addPlacePermissions(context, props.place.currentOwner, props.place.placeId, values.permissionsTo, permissions, (completed: boolean) => {
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
                isValid,
                values,
                handleChange,
                setFieldValue
            }) => {
                return (
                    <Form>
                        <div className="mb-3">
                            <label htmlFor="permissionsTo" className="form-label">Permittee</label>
                            <Field id="permissionsTo" name="permissionsTo" type="text" className="form-control" aria-describedby="permissionsToHelp" disabled={isSubmitting} />
                            <div id="permissionsToHelp" className="form-text">The address you want to give permissions to.</div>
                            <ErrorMessage name="permissionsTo" children={errorDisplay}/>
                        </div>

                        <div>
                            <Field id="permissionPlaceItems" name="permissionPlaceItems" type="checkbox" className="form-check-input me-2" aria-describedby="permissionPlaceItemsHelp" disabled={isSubmitting || values.permissionFull}/>
                            <label htmlFor="permissionPlaceItems" className="form-label">Place Items <div id="permissionPlaceItemsHelp" className="form-text">Can place Items.</div></label>
                        </div>

                        <div>
                            <Field id="permissionModifyAll" name="permissionModifyAll" type="checkbox" className="form-check-input me-2" aria-describedby="permissionModifyAllHelp" disabled={isSubmitting || values.permissionFull}/>
                            <label htmlFor="permissionModifyAll" className="form-label">Modify All <div id="permissionModifyAllHelp" className="form-text">Can remove and edit Items from any user.</div></label>
                        </div>

                        <div>
                            <Field id="permissionProps" name="permissionProps" type="checkbox" className="form-check-input me-2" aria-describedby="permissionPropsHelp" disabled={isSubmitting || values.permissionFull}/>
                            <label htmlFor="permissionProps" className="form-label">Edit Props <div id="permissionPropsHelp" className="form-text">Can edit Place properties.</div></label>
                        </div>

                        {/*<div>
                            <Field id="permissionCanSell" name="permissionCanSell" type="checkbox" className="form-check-input me-2" aria-describedby="permissionCanSellHelp" disabled={isSubmitting || values.permissionFull}/>
                            <label htmlFor="permissionCanSell" className="form-label">Can Sell <div id="permissionCanSellHelp" className="form-text">Can place for sale items.</div></label>
                        </div>*/}

                        <div>
                            <Field id="permissionFull" name="permissionFull" type="checkbox" className="form-check-input me-2" aria-describedby="permissionFullHelp" disabled={isSubmitting}
                                onChange={(e: React.ChangeEvent<any>) => { handleChange(e); onFullPermissionsChange(e, setFieldValue); }}/>
                            <label htmlFor="permissionFull" className="form-label">Full Permissions <div id="permissionFullHelp" className="form-text">All of the other permissions.</div></label>
                        </div>
                        
                        <button type="submit" className={`btn btn-${triHelper(state.successState, "danger", "primary", "success")}`} disabled={isSubmitting || !isValid}>
                            {isSubmitting && (<span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>)} add Permissions</button><br/>
                        {state.error && ( <small className='text-danger d-inline-block mt-2'>Adding Place permissions failed: {state.error}</small> )}
                    </Form>
                )
            }}
        </Formik>
    );
};
