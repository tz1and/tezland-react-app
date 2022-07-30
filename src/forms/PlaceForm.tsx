import React from 'react';
import {
    Formik,
    Form,
    Field,
    FormikErrors,
    ErrorMessage
} from 'formik';
import BigNumber from 'bignumber.js';
import assert from 'assert';
import ItemNode from '../world/nodes/ItemNode';
import ItemTracker from '../controllers/ItemTracker';

interface PlaceFormValues {
    tokenId: number;
    itemAmount: number;
    itemPrice: number;
}

type PlaceFormProps = {
    closeForm(): void;
    placedItem: ItemNode;
    maxQuantity: number;
}

export const PlaceForm: React.FC<PlaceFormProps> = (props) => {
    const initialValues: PlaceFormValues = {
        tokenId: props.placedItem.tokenId.toNumber(),
        itemAmount: 1,
        itemPrice: 0
    };

    const errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    const cancelForm = () => {
        props.placedItem.dispose();
        props.closeForm();
    }

    return (
        <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
            <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={cancelForm} />
            <h2>place Item</h2>
            <Formik
                initialValues={initialValues}
                validate = {(values) => {
                    const errors: FormikErrors<PlaceFormValues> = {};
                  
                    if (values.itemPrice !== 0 && values.itemPrice < 0.000001) {
                        errors.itemPrice = 'Price invalid';
                    }

                    if (values.itemAmount < 1 || values.itemAmount > props.maxQuantity) {
                        errors.itemAmount = 'Amount invalid';
                    }
                  
                    return errors;
                }}
                onSubmit={(values, actions) => {
                    assert(props.placedItem);
                    // set amount and price on Node (item) metadata.
                    if (props.placedItem) {
                        props.placedItem.itemAmount = new BigNumber(values.itemAmount);
                        props.placedItem.xtzPerItem = values.itemPrice;

                        ItemTracker.trackTempItem(props.placedItem.placeId, values.tokenId, values.itemAmount);
                    }

                    actions.setSubmitting(false);

                    props.closeForm();
                }}
            >
                {({
                    setFieldValue,
                    isSubmitting,
                    isValid
                }) => {
                    return (
                        <Form>
                            <div className="mb-3">
                                <label htmlFor="tokenId" className="form-label">Token ID</label>
                                <Field id="tokenId" name="tokenId" type="number" className="form-control" aria-describedby="idHelp" disabled={true} />
                                <div id="idHelp" className="form-text">The id of the Item you want to place. Must be owned.</div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="itemAmount" className="form-label">Amount</label>
                                <Field id="itemAmount" name="itemAmount" type="number" min={1} max={props.maxQuantity} className="form-control" aria-describedby="amountHelp" disabled={isSubmitting} autoFocus={true} />
                                <div id="amountHelp" className="form-text">The number of Items to place. Can't be more than the amount you own.<br/>(Current balance: {props.maxQuantity})</div>
                                <ErrorMessage name="itemAmount" children={errorDisplay}/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="itemPrice" className="form-label">Price</label>
                                <div className="input-group mb-3">
                                    <span className="input-group-text">{'\uA729'}</span>
                                    <Field id="itemPrice" name="itemPrice" type="number" min={0} step="any" className="form-control" aria-describedby="priceHelp" disabled={isSubmitting} />
                                </div>
                                <div id="priceHelp" className="form-text">The price for each Item. Set 0&#42793; if you don't want to swap.<br/>
                                For <i>freebies</i>, <button type="button" className="btn btn-sm btn-link p-0 m-0 align-baseline" onClick={() => setFieldValue('itemPrice', 0.000001)}>set 0.000001&#42793;</button>.</div>
                                <ErrorMessage name="itemPrice" children={errorDisplay}/>
                            </div>
                            <div className="form-text mb-3">There is a 2.5% management fee on successful swaps.</div>
                            <button type="submit" className="btn btn-primary mb-3" disabled={isSubmitting || !isValid}>place Item</button><br/>
                            <div className='bg-info bg-info p-3 text-dark rounded small mb-2'>Placed Items are transferred to the World contract, but are<br/>retrievable only by you (the owner) or a potential new owner.</div>
                        </Form>
                    )
                }}
            </Formik>
        </div>
    );
};
