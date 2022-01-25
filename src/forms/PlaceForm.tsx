import React from 'react';
import {
    Formik,
    Form,
    Field,
    FormikErrors
} from 'formik';
import { Node, Nullable } from '@babylonjs/core';
import { InstanceMetadata } from '../world/Place';
import BigNumber from 'bignumber.js';

interface PlaceFormValues {
    /*itemTitle: string;
    itemDescription: string;
    itemTags: string;*/
    itemId: number;
    itemAmount: number;
    itemPrice: number;
    //itemFile: ArrayBuffer;
}

type PlaceFormProps = {
    closeForm(cancelled: boolean): void;
    placedItem: Nullable<Node>;
}

export const PlaceForm: React.FC<PlaceFormProps> = (props) => {
    const initialValues: PlaceFormValues = {
        itemId: (props.placedItem?.metadata as InstanceMetadata).itemTokenId.toNumber(),
        itemAmount: 1,
        itemPrice: 0
    };

    return (
        <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
            <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => props.closeForm(true)} />
            <h2>place Item</h2>
            <Formik
                initialValues={initialValues}
                validate = {(values) => {
                    const errors: FormikErrors<PlaceFormValues> = {};
                  
                    if (values.itemPrice < 0) {
                        errors.itemPrice = 'Price invalid';
                    }

                    if (values.itemAmount < 1 || values.itemAmount > 10000) {
                        errors.itemAmount = 'Amount invalid';
                    }
                  
                    return errors;
                }}
                onSubmit={(values, actions) => {
                    //console.log({ values, actions });
                    //alert(JSON.stringify(values, null, 2));

                    // set amount and price on Node (item) metadata.
                    if (props.placedItem) {
                        const metadata = props.placedItem.metadata as InstanceMetadata;
                        metadata.itemAmount = new BigNumber(values.itemAmount);
                        metadata.xtzPerItem = values.itemPrice;
                    }

                    actions.setSubmitting(false);

                    props.closeForm(false);
                }}
            >
                {({
                    errors,
                    touched,
                    isSubmitting,
                    isValid
                }) => {
                    return (
                        <Form>
                            <div className="mb-3">
                                <label htmlFor="itemId" className="form-label">Item ID</label>
                                <Field id="itemId" name="itemId" type="number" className="form-control" aria-describedby="idHelp" disabled={true} />
                                <div id="idHelp" className="form-text">The id of the item you want to place. Must be owned.</div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="itemAmount" className="form-label">Amount</label>
                                <Field id="itemAmount" name="itemAmount" type="number" className="form-control" aria-describedby="amountHelp" disabled={isSubmitting} autoFocus={true} />
                                <div id="amountHelp" className="form-text">The number of Items to place. Can't be more than the amount you own.</div>
                                {touched.itemAmount && errors.itemAmount && <small className="text-danger">{errors.itemAmount}</small>}
                            </div>
                            <div className="mb-3">
                                <label htmlFor="itemPrice" className="form-label">Price</label>
                                <div className="input-group mb-3">
                                    <span className="input-group-text">{'\uA729'}</span>
                                    <Field id="itemPrice" name="itemPrice" type="number" className="form-control" aria-describedby="priceHelp" disabled={isSubmitting} />
                                </div>
                                <div id="priceHelp" className="form-text">The price for each item. Set 0&#42793; if not for sale.<br/>There is a 2.5% fee on successful swap.</div>
                                {touched.itemPrice && errors.itemPrice && <small className="text-danger">{errors.itemPrice}</small>}
                            </div>
                            <button type="submit" className="btn btn-primary mb-3" disabled={isSubmitting || !isValid}>place Item</button><br/>
                            <small>Note: Placed Items are transferred to the World contract,<br/> but are retrievable only by you (the owner) and a potential buyer.</small>
                        </Form>
                    )
                }}
            </Formik>
        </div>
    );
};
