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
import { triHelper, Trilean } from './FormUtils';
import TokenKey from '../utils/TokenKey';


interface TransferFormValues {
    /*itemTitle: string;
    itemDescription: string;
    itemTags: string;*/
    tokenKey: string;
    itemAmount: number;
    transferTo: string;
    //itemFile: ArrayBuffer;
}

type TransferFormProps = {
    closeForm(): void;
    tokenKey: TokenKey;
    maxQuantity: number;
}

type TransferFormState = {
    error: string;
    successState: Trilean;
}

export const TransferForm: React.FC<TransferFormProps> = (props) => {
    const context = useTezosWalletContext();

    const [state, setState] = useState<TransferFormState>({error: "", successState: 0});
    
    const initialValues: TransferFormValues = {
        tokenKey: props.tokenKey.toString(),
        itemAmount: 1,
        transferTo: ""
    };

    const errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    return (
        <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
            <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => props.closeForm()} />
            <h2>transfer Item</h2>
            <Formik
                initialValues={initialValues}
                validate = {(values) => {
                    const errors: FormikErrors<TransferFormValues> = {};

                    if (values.itemAmount < 1 || values.itemAmount > props.maxQuantity) {
                        errors.itemAmount = 'Amount invalid';
                    }

                    if (validateAddress(values.transferTo) !== ValidationResult.VALID) {
                        errors.transferTo = "Address invalid.";
                    }
                  
                    return errors;
                }}
                onSubmit={(values, actions) => {
                    Contracts.transferItem(context, props.tokenKey, values.itemAmount, values.transferTo, (completed: boolean) => {
                        actions.setSubmitting(false);
    
                        if (completed) {
                            //setState({error: "", successState: 1});
                            props.closeForm();
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
                                <label htmlFor="tokenKey" className="form-label">Token Key</label>
                                <Field id="tokenKey" name="tokenKey" type="string" className="form-control" aria-describedby="tokenKeyHelp" disabled={true} />
                                <div id="tokenKeyHelp" className="form-text">The key of the item you want to transfer. Must be owned.</div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="itemAmount" className="form-label">Amount</label>
                                <Field id="itemAmount" name="itemAmount" type="number" min={1} max={props.maxQuantity} className="form-control" aria-describedby="amountHelp" disabled={isSubmitting} autoFocus={true} />
                                <div id="amountHelp" className="form-text">The number of Items to transfer. Can't be more than the amount you own.<br/>(Current balance: {props.maxQuantity})</div>
                                <ErrorMessage name="itemAmount" children={errorDisplay}/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="transferTo" className="form-label">Transfer to</label>
                                <Field id="transferTo" name="transferTo" type="text" className="form-control" aria-describedby="transferToHelp" disabled={isSubmitting} />
                                <div id="transferToHelp" className="form-text">The address you want to transfer the item to.</div>
                                <ErrorMessage name="transferTo" children={errorDisplay}/>
                            </div>
                            <button type="submit" className={`btn btn-${triHelper(state.successState, "danger", "primary", "success")} mb-3`} disabled={isSubmitting || !isValid}>
                                {isSubmitting && (<span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>)} transfer Items</button><br/>
                            {state.error && ( <small className='text-danger d-inline-block mt-2'>Transfer Items failed: {state.error}</small> )}
                            <div className='bg-info bg-warning p-3 text-dark rounded small mb-2'>When you transfer a number of Items, they are removed from your<br/>balance and added to the address' balance your transferring it to.</div>
                        </Form>
                    )
                }}
            </Formik>
        </div>
    );
};
