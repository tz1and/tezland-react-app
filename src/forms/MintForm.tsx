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
import { createItemTokenMetadata, get_root_file_from_dir } from '../ipfs/ipfs';
import { BlobLike, blobToBloblike, getFileExt } from '../utils/Utils';
import { useTezosWalletContext } from '../components/TezosWalletContext';
import Conf from '../Config';

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
    
    const context = useTezosWalletContext();

    return (
        <div className='p-4 m-4 bg-light border-0 rounded-3 text-dark position-relative'>
            <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => props.closeForm(true)} />
            <h2>mint Item</h2>
            <Formik
                initialValues={initialValues}
                validate = {(values) => {
                    const errors: FormikErrors<MintFormValues> = {};

                    if (!values.itemFile) {
                        errors.itemFile = 'No file selected'
                    } else if (modelPreviewRef.current!.state.polycount > 1000000) {
                        // This is just here to filter out some obvious trolls.
                        errors.itemFile = 'Mesh has too many polygons.';
                    }

                    // TODO: validate model! If it's valid and loads.

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

                    try {
                        // check if wallet is connected first.
                        if(!context.isWalletConnected()) throw new Error("No wallet connected");

                        const thumbnail = await modelPreviewRef.current!.getThumbnail();

                        var mime_type;
                        const file_ext = getFileExt(values.itemFile!.name);
                        if(file_ext === "glb") mime_type = "model/gltf-binary";
                        else if(file_ext === "gltf") mime_type = "model/gltf+json";
                        else throw new Error("Unsupported mimeType");

                        const metadata = createItemTokenMetadata({
                            name: values.itemTitle,
                            description: values.itemDescription,
                            minter: context.walletPHK(),
                            artifactUri: await blobToBloblike(values.itemFile!),
                            thumbnailUri: { dataUri: thumbnail, type: "image/png" } as BlobLike,
                            tags: values.itemTags,
                            formats: [
                                {
                                    mimeType: mime_type
                                }
                            ]
                        })

                        // Post here and wait for result
                        const requestOptions = {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: metadata
                        };
                        const response = await fetch(Conf.backend_url + "/upload", requestOptions)
                        const data = await response.json();

                        if(data.error) {
                            throw new Error("Upload failed: " + data.error);
                        }
                        else if (data.metdata_uri) {
                            // Try and get the file Uri
                            const fileUri = await get_root_file_from_dir(data.metdata_uri);

                            // mint item.
                            await Contracts.mintItem(context, fileUri, values.itemRoyalties, values.itemAmount);

                            // when successful, close form.
                            props.closeForm(false);

                            // return to avoid setting properties after unmount.
                            return;
                        }
                        else throw new Error("Backend: malformed response");
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
