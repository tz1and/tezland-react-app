import React from 'react';
import {
    Formik,
    Form,
    Field,
    FormikErrors
} from 'formik';
import CustomFileUpload from './CustomFileUpload'
import ModelPreview from './ModelPreview'
import Contracts from '../tz/Contracts'
import { upload_model, upload_item_metadata, upload_thumbnail } from '../ipfs/ipfs'
import { dataURItoBlob, readFileAsync } from '../tz/Utils';

interface MintFormValues {
    itemTitle: string;
    itemDescription: string;
    itemTags: string;
    itemAmount: number;
    itemRoyalties: number;
    itemFile?: File;
}

type MintFormProps = {
    closeForm(cancelled: boolean): void;
}

type MintFormState = {
    error: string
}

export const MintFrom: React.FC<MintFormProps> = (props) => {
    const initialValues: MintFormValues = { itemTitle: "", itemDescription: "", itemTags: "", itemAmount: 1, itemRoyalties: 10 };
    const state: MintFormState = { error: "" }
    const modelPreviewRef = React.createRef<ModelPreview>();

    return (
        <div className='p-4 bg-light border-0 rounded-3 text-dark position-relative'>
            <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => props.closeForm(true)} />
            <h2>mint Item</h2>
            <Formik
                initialValues={initialValues}
                validate = {(values) => {
                    const errors: FormikErrors<MintFormValues> = {};

                    if (!values.itemFile) {
                        errors.itemFile = 'No file selected'
                    }

                    if (values.itemTitle.length === 0) {
                        errors.itemTitle = 'Title required'
                    }
                  
                    if (values.itemRoyalties < 0 || values.itemRoyalties > 25) {
                        errors.itemRoyalties = 'Royalties invalid';
                    }

                    if (values.itemAmount < 1 || values.itemAmount > 10000) {
                        errors.itemAmount = 'Amount invalid';
                    }
                  
                    return errors;
                }}
                onSubmit={async (values, actions) => {
                    // clear error state
                    state.error = '';

                    // TODO: validate model! polycount, if it loads, etc.

                    try {
                        // check if wallet is connected first.
                        if(!await Contracts.isWalletConnected()) throw new Error("No wallet connected");

                        // read model file.
                        const buffer = await readFileAsync(values.itemFile!);

                        // upload model.
                        const model_url = await upload_model(buffer);

                        // TOOD: check modelPreviewRef.current
                        const thumbnail_url = await upload_thumbnail(dataURItoBlob(await modelPreviewRef.current!.getThumbnail()));

                        // upload metadata.
                        const metadata_url = await upload_item_metadata(await Contracts.walletPHK(), values.itemTitle, values.itemDescription, values.itemTags, model_url, thumbnail_url);

                        // mint item.
                        await Contracts.mintItem(metadata_url, values.itemRoyalties, values.itemAmount);

                        // when successful, close form.
                        props.closeForm(false);

                        // return to avoid setting properties after unmount.
                        return;
                    } catch(e: any) {
                        state.error = e.message;
                    }

                    actions.setSubmitting(false);
                }}
            >

                {({
                    values,
                    isSubmitting,
                    errors,
                    touched,
                    isValid
                    /*errors,
                    touched,
                    handleSubmit,
                    validating,
                    valid*/
                }) => {
                    return (
                        <Form>
                            <div className='row'>
                                <div className='col'>
                                    <div className="mb-3">
                                        <label htmlFor="itemFile" className="form-label">3D Model file</label>
                                        <Field id="itemFile" name="itemFile" className="form-control" aria-describedby="fileHelp" component={CustomFileUpload} disabled={isSubmitting} />
                                        <div id="fileHelp" className="form-text">Only gltf models are supported.</div>
                                        {touched.itemFile && errors.itemFile && <small className="text-danger">{errors.itemFile}</small>}
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="itemTitle" className="form-label">Title</label>
                                        <Field id="itemTitle" name="itemTitle" type="text" className="form-control" disabled={isSubmitting} />
                                        {touched.itemTitle && errors.itemTitle && <small className="text-danger">{errors.itemTitle}</small>}
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="itemDescription" className="form-label">Description</label>
                                        <Field id="itemDescription" name="itemDescription" component="textarea" rows={2} className="form-control" disabled={isSubmitting} />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="itemTags" className="form-label">Tags</label>
                                        <Field id="itemTags" name="itemTags" type="text" className="form-control" aria-describedby="tagsHelp" disabled={isSubmitting} />
                                        <div id="tagsHelp" className="form-text">List of tags, separated by <i>;</i>.</div>
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="itemAmount" className="form-label">Amount</label>
                                        <Field id="itemAmount" name="itemAmount" type="number" className="form-control" aria-describedby="amountHelp" disabled={isSubmitting} />
                                        <div id="amountHelp" className="form-text">The amount of Items to mint. 1 - 10000.</div>
                                        {touched.itemAmount && errors.itemAmount && <small className="text-danger">{errors.itemAmount}</small>}
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="itemRoyalties" className="form-label">Royalties</label>
                                        <div className="input-group mb-3">
                                            <span className="input-group-text">%</span>
                                            <Field id="itemRoyalties" name="itemRoyalties" type="number" className="form-control" aria-describedby="royaltiesHelp" disabled={isSubmitting} />
                                        </div>
                                        <div id="royaltiesHelp" className="form-text">The royalties you earn for this Item. 0 - 25%.</div>
                                        {touched.itemRoyalties && errors.itemRoyalties && <small className="text-danger">{errors.itemRoyalties}</small>}
                                    </div>
                                    <button type="submit" className="btn btn-primary" disabled={isSubmitting || !isValid}>{isSubmitting === true && (<span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>)} mint Item</button>
                                </div>
                                <div className='col'>
                                    <ModelPreview file={values.itemFile} ref={modelPreviewRef} /><br/>
                                    {state.error.length > 0 && ( <small className='text-danger'>Minting failed: {state.error}</small> )}
                                </div>
                            </div>
                        </Form>
                    )
                }}
            </Formik>
        </div>
    );
};
