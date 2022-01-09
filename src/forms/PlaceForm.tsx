import React from 'react';
import {
  Formik,
  Form,
  Field
} from 'formik';
import { Node, Nullable } from '@babylonjs/core';

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
  const initialValues: PlaceFormValues = { itemId: props.placedItem?.metadata.itemId, itemAmount: 1, itemPrice: 0 };
  
  return (
    <div className='p-4 bg-light border-0 rounded-3 text-dark position-relative'>
      <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => props.closeForm(true)} />
      <h2>place Item</h2>
      <Formik
        initialValues={initialValues}
        onSubmit={(values, actions) => {
          //console.log({ values, actions });
          //alert(JSON.stringify(values, null, 2));
          
          // set amount and price on Node (item) metadata.
          if(props.placedItem) {
            props.placedItem.metadata.itemAmount = values.itemAmount;
            props.placedItem.metadata.itemPrice = values.itemPrice;
          }

          actions.setSubmitting(false);

          props.closeForm(false);
        }}
      >
        <Form>
            <div className="mb-3">
                <label htmlFor="itemId" className="form-label">Item ID</label>
                <Field id="itemId" name="itemId" type="number" className="form-control" aria-describedby="idHelp" disabled={true} />
                <div id="idHelp" className="form-text">The id of the item you want to place. Must be owned.</div>
            </div>
            <div className="mb-3">
                <label htmlFor="itemAmount" className="form-label">Amount</label>
                <Field id="itemAmount" name="itemAmount" type="number" className="form-control" aria-describedby="amountHelp" />
                <div id="amountHelp" className="form-text">The number of Items to place. Can't be more than the amount you own.</div>
            </div>
            <div className="mb-3">
                <label htmlFor="itemPrice" className="form-label">Price</label>
                <div className="input-group mb-3">
                    <span className="input-group-text">{'\uA729'}</span>
                    <Field id="itemPrice" name="itemPrice" type="number" className="form-control" aria-describedby="priceHelp" />
                </div>
                <div id="priceHelp" className="form-text">The price for each item. 0 if not for sale.</div>
            </div>
            <button type="submit" className="btn btn-primary">place</button>
        </Form>
      </Formik>
    </div>
  );
};
