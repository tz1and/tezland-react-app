import React, { useState } from 'react';
import {
    Formik,
    Form,
    Field,
    FormikErrors,
    ErrorMessage
} from 'formik';
import CustomFileUpload from './CustomFileUpload'
import ModelPreview from './ModelPreview'
import Contracts from '../tz/Contracts'
import { createItemTokenMetadata } from '../ipfs/ipfs';
import { BlobLike, blobToBloblike, getFileExt } from '../utils/Utils';
import { useTezosWalletContext } from '../components/TezosWalletContext';
import Conf from '../Config';
import AppSettings from '../storage/AppSettings';

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
    error: string;
    modelLimitWarning: string;
}

// todo: make this a class component...
export const MintFrom: React.FC<MintFormProps> = (props) => {
    const initialValues: MintFormValues = { itemTitle: "", itemDescription: "", itemTags: "", itemAmount: 1, itemRoyalties: 10 };
    const [formState, setFormState] = useState({ error: "", modelLimitWarning: "" } as  MintFormState);
    const modelPreviewRef = React.createRef<ModelPreview>();
    
    const context = useTezosWalletContext();

    const errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    return (
        <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
            <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => props.closeForm(true)} />
            <h2>mint Item</h2>
            <Formik
                initialValues={initialValues}
                validate = {(values) => {
                    const errors: FormikErrors<MintFormValues> = {};

                    if (!values.itemFile) {
                        errors.itemFile = 'No file selected'
                    } else if (modelPreviewRef.current!.state.polycount > 10000000) {
                        // This is just here to filter out some obvious trolls.
                        errors.itemFile = 'Mesh has too many polygons.';
                    }

                    // TODO: validate model! If it's valid and loaded, etc.

                    // Model limits warning
                    if(values.itemFile) {
                        let modelLimitWarning = '';
                        if(modelPreviewRef.current!.state.polycount > AppSettings.defaults.polygonLimit)
                            modelLimitWarning = 'Exceeds default polygon limit. It may not be displayed.';

                        if(values.itemFile.size > AppSettings.defaults.fileSizeLimit)
                            modelLimitWarning = 'Exceeds default file size limit. It may not be displayed.';

                        setFormState({ modelLimitWarning: modelLimitWarning, error: formState.error });
                    }

                    if (values.itemTitle.length === 0) {
                        errors.itemTitle = 'Title required';
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
                    setFormState({ modelLimitWarning: formState.modelLimitWarning, error: '' });

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
                                    mimeType: mime_type,
                                    fileSize: values.itemFile!.size
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
                        else if (data.metdata_uri && data.cid) {
                            // mint item.
                            await Contracts.mintItem(context, data.metdata_uri, values.itemRoyalties, values.itemAmount);

                            // when successful, close form.
                            props.closeForm(false);

                            // return to avoid setting properties after unmount.
                            return;
                        }
                        else throw new Error("Backend: malformed response");
                    } catch(e: any) {
                        setFormState({ modelLimitWarning: formState.modelLimitWarning, error: e.message });
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
                                        <ErrorMessage name="itemFile" children={errorDisplay}/>
                                        {touched.itemFile && formState.modelLimitWarning && <small className="bg-warning text-dark rounded-1 my-1 p-1">
                                            <i className="bi bi-exclamation-triangle-fill"></i> {formState.modelLimitWarning}</small>}
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="itemTitle" className="form-label">Title</label>
                                        <Field id="itemTitle" name="itemTitle" type="text" className="form-control" disabled={isSubmitting} />
                                        <ErrorMessage name="itemTitle" children={errorDisplay}/>
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
                                        <ErrorMessage name="itemAmount" children={errorDisplay}/>
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="itemRoyalties" className="form-label">Royalties</label>
                                        <div className="input-group mb-3">
                                            <span className="input-group-text">%</span>
                                            <Field id="itemRoyalties" name="itemRoyalties" type="number" className="form-control" aria-describedby="royaltiesHelp" disabled={isSubmitting} />
                                        </div>
                                        <div id="royaltiesHelp" className="form-text">The royalties you earn for this Item. 0 - 25%.</div>
                                        <ErrorMessage name="itemRoyalties" children={errorDisplay}/>
                                    </div>
                                    <button type="submit" className="btn btn-primary" disabled={isSubmitting || !isValid}>{isSubmitting === true && (<span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>)} mint Item</button>
                                </div>
                                <div className='col'>
                                    <ModelPreview file={values.itemFile} ref={modelPreviewRef} />
                                    <div className='bg-info bg-warning p-3 text-dark rounded small mb-2'>Please be respectful of other's property :)</div>
                                    {formState.error.length > 0 && ( <small className='text-danger'>Minting failed: {formState.error}</small> )}
                                </div>
                            </div>
                        </Form>
                    )
                }}
            </Formik>
        </div>
    );
};
