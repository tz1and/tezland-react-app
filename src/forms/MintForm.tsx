import React from 'react';
import {
  Formik,
  Form,
  Field
} from 'formik';
import CustomFileUpload from './CustomFileUpload'

interface MintFormValues {
  /*itemTitle: string;
  itemDescription: string;
  itemTags: string;*/
  itemAmount: number;
  itemRoyalties: number;
  //itemFile: ArrayBuffer;
}

type MintFormProps = {
  closeForm(): void;
}

export const MintFrom: React.FC<MintFormProps> = (props) => {
  const initialValues: MintFormValues = { itemAmount: 1, itemRoyalties: 10 };
  return (
    <div className='p-4 bg-light border-0 rounded-3 text-dark position-relative'>
      <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={props.closeForm} />
      <h2>new Item</h2>
      <Formik
        initialValues={initialValues}
        onSubmit={(values, actions) => {
          console.log({ values, actions });
          alert(JSON.stringify(values, null, 2));
          actions.setSubmitting(false);
        }}
      >
        <Form>
            <div className="mb-3">
                <label htmlFor="itemFile" className="form-label">3D Model file</label>
                <Field id="itemFile" name="itemFile" className="form-control" aria-describedby="fileHelp" component={CustomFileUpload} />
                <div id="fileHelp" className="form-text">Only gltf models are supported.</div>
            </div>
            <div className="mb-3">
                <label htmlFor="itemTitle" className="form-label">Title</label>
                <Field id="itemTitle" name="itemTitle" type="text" className="form-control"/>
            </div>
            <div className="mb-3">
                <label htmlFor="itemDescription" className="form-label">Description</label>
                <Field id="itemDescription" name="itemDescription" component="textarea" rows={2} className="form-control"/>
            </div>
            <div className="mb-3">
                <label htmlFor="itemTags" className="form-label">Tags</label>
                <Field id="itemTags" name="itemTags" type="text" className="form-control" aria-describedby="tagsHelp" />
                <div id="tagsHelp" className="form-text">List of tags, separated by <i>;</i>.</div>
            </div>
            <div className="mb-3">
                <label htmlFor="itemAmount" className="form-label">Amount</label>
                <Field id="itemAmount" name="itemAmount" type="number" className="form-control" aria-describedby="amountHelp" />
                <div id="amountHelp" className="form-text">The amount of Items to mint. 1 - 10000.</div>
            </div>
            <div className="mb-3">
                <label htmlFor="itemRoyalties" className="form-label">Royalties</label>
                <div className="input-group mb-3">
                    <span className="input-group-text">%</span>
                    <Field id="itemRoyalties" name="itemRoyalties" type="number" className="form-control" aria-describedby="royaltiesHelp" />
                </div>
                <div id="royaltiesHelp" className="form-text">The royalties you earn for this Item. 0 - 25%.</div>
            </div>
            <button type="submit" className="btn btn-primary">mint</button>
        </Form>
      </Formik>
    </div>
  );
};
