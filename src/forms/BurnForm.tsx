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
import { triHelper, Trilean } from './FormUtils';

interface BurnFormValues {
    /*itemTitle: string;
    itemDescription: string;
    itemTags: string;*/
    itemId: number;
    itemAmount: number;
    //itemFile: ArrayBuffer;
}

type BurnFormProps = {
    closeForm(): void;
    itemId: number;
}

type BurnFormState = {
    error: string;
    successState: Trilean;
}

export const BurnForm: React.FC<BurnFormProps> = (props) => {
    const context = useTezosWalletContext();

    const [state, setState] = useState<BurnFormState>({error: "", successState: 0});
    
    const initialValues: BurnFormValues = {
        itemId: props.itemId,
        itemAmount: 0
    };

    const errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    return (
        <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
            <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => props.closeForm()} />
            <h2>burn Item</h2>
            <Formik
                initialValues={initialValues}
                validate = {(values) => {
                    const errors: FormikErrors<BurnFormValues> = {};

                    if (values.itemAmount < 1 || values.itemAmount > 10000) {
                        errors.itemAmount = 'Amount invalid';
                    }
                  
                    return errors;
                }}
                onSubmit={(values, actions) => {
                    Contracts.burnItem(context, values.itemId, values.itemAmount, (completed: boolean) => {
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
                                <label htmlFor="itemId" className="form-label">Item ID</label>
                                <Field id="itemId" name="itemId" type="number" className="form-control" aria-describedby="idHelp" disabled={true} />
                                <div id="idHelp" className="form-text">The id of the item you want to burn. Must be owned.</div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="itemAmount" className="form-label">Amount</label>
                                <Field id="itemAmount" name="itemAmount" type="number" className="form-control" aria-describedby="amountHelp" disabled={isSubmitting} autoFocus={true} />
                                <div id="amountHelp" className="form-text">The number of Items to burn. Can't be more than the amount you own.</div>
                                <ErrorMessage name="itemAmount" children={errorDisplay}/>
                            </div>
                            <button type="submit" className={`btn btn-${triHelper(state.successState, "danger", "warning", "success")} mb-3`} disabled={isSubmitting || !isValid}>
                                {isSubmitting && (<span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>)} burn Items</button><br/>
                            {state.error && ( <small className='text-danger d-inline-block mt-2'>Burn Items properties failed: {state.error}</small> )}
                            <div className='bg-info bg-danger p-3 text-light rounded small mb-2'>Burnt Items are irrecoverably lost. Be very careful when using!</div>
                        </Form>
                    )
                }}
            </Formik>
        </div>
    );
};
