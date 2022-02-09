import React from 'react';
import {
    Formik,
    Form,
    Field,
    FormikErrors,
    ErrorMessage,
    FormikProps
} from 'formik';
import CustomFileUpload from './CustomFileUpload'
import ModelPreview, { ModelLoadingState } from './ModelPreview'
import Contracts from '../tz/Contracts'
import { createItemTokenMetadata } from '../ipfs/ipfs';
import { FileLike, fileToFileLike, getFileExt } from '../utils/Utils';
import TezosWalletContext from '../components/TezosWalletContext';
import Conf from '../Config';
import AppSettings from '../storage/AppSettings';
import { FormTrisate, triHelper } from './FormUtils';

interface MintFormValues {
    itemTitle: string;
    itemDescription: string;
    itemTags: string;
    itemAmount: number;
    itemRoyalties: number;
    itemFile?: File | undefined;
}

type MintFormProps = {
    closable?: boolean;
    closeForm(cancelled: boolean): void;
}

type MintFormState = {
    error: string,
    successState: FormTrisate,
    modelLoadingState: ModelLoadingState;
    modelLimitWarning: string;
}

export class MintFrom extends React.Component<MintFormProps, MintFormState> {
    private initialValues: MintFormValues = { itemTitle: "", itemDescription: "", itemTags: "", itemAmount: 1, itemRoyalties: 10 };
    private modelPreviewRef = React.createRef<ModelPreview>();
    private formikRef = React.createRef<FormikProps<MintFormValues>>();
    private isClosable: boolean;

    private closeTimeout: NodeJS.Timeout | null = null;

    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;
    
    constructor(props: MintFormProps) {
        super(props);
        this.state = {
            error: "",
            successState: -1,
            modelLoadingState: "none",
            modelLimitWarning: ""
        };

        this.isClosable = this.props.closable === undefined ? true : this.props.closable;
    }

    override componentWillUnmount() {
        if(this.closeTimeout) clearInterval(this.closeTimeout);
    }

    private errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    private modelLoaded = (loadingState: ModelLoadingState, modelFileSize: number, polyCount: number) => {
        // Model limits warning
        if(loadingState === "success") {
            let modelLimitWarning = '';
            if(polyCount > AppSettings.polygonLimit.defaultValue)
                modelLimitWarning = 'Exceeds default polygon limit. It may not be displayed.';

            if(modelFileSize > AppSettings.fileSizeLimit.defaultValue)
                modelLimitWarning = 'Exceeds default file size limit. It may not be displayed.';

            this.setState({ modelLimitWarning: modelLimitWarning, modelLoadingState: loadingState });
        }
        else this.setState({ modelLimitWarning: "", modelLoadingState: loadingState });

        this.formikRef.current?.validateField("itemFile")
    }

    private async uploadAndMint(values: MintFormValues, callback?: (completed: boolean) => void) {
        const thumbnail = await this.modelPreviewRef.current!.getThumbnail();

        // TODO: validate mimeType in validation.
        var mime_type;
        const file_ext = getFileExt(values.itemFile!.name);
        if(file_ext === "glb") mime_type = "model/gltf-binary";
        else if(file_ext === "gltf") mime_type = "model/gltf+json";
        else throw new Error("Unsupported mimeType");

        const metadata = createItemTokenMetadata({
            name: values.itemTitle,
            description: values.itemDescription,
            minter: this.context.walletPHK(),
            artifactUri: await fileToFileLike(values.itemFile!),
            thumbnailUri: { dataUri: thumbnail, type: "image/png", name: "thumbnail.png" } as FileLike,
            tags: values.itemTags,
            formats: [
                {
                    mimeType: mime_type,
                    fileSize: values.itemFile!.size
                }
            ]
        });

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
            await Contracts.mintItem(this.context, data.metdata_uri, values.itemRoyalties, values.itemAmount, callback);
        }
        else throw new Error("Backend: malformed response");
    }

    override render(): React.ReactNode {
        return (
            <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
                {this.isClosable && <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => this.props.closeForm(true)} />}
                <h2>mint Item</h2>
                <Formik
                    innerRef={this.formikRef}
                    initialValues={this.initialValues}
                    validate = {(values) => {
                        const errors: FormikErrors<MintFormValues> = {};

                        if (!values.itemFile) {
                            errors.itemFile = 'No file selected';
                        } else {
                            // this is "delayed" because it depends on async state...
                            // TODO: improve, somehow.
                            if(this.state.modelLoadingState === "failed")
                                errors.itemFile = 'Model file failed to load.';

                            // This is just here to filter out some obvious trolls.
                            if (this.modelPreviewRef.current!.state.polycount > 10000000)
                                errors.itemFile = 'Mesh has too many polygons.';
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

                        // revalidation clears trisate and error
                        this.setState({error: "", successState: -1});
                    
                        return errors;
                    }}
                    onSubmit={(values, actions) => {
                        this.uploadAndMint(values, (completed: boolean) => {
                            if (completed) {
                                if(!this.isClosable) actions.setSubmitting(false);

                                this.setState({error: "", successState: 1}, () => {
                                    // If closable close form after a short time.
                                    if(this.isClosable) this.closeTimeout = setTimeout(() => {
                                        this.props.closeForm(false);
                                    }, 1000);
                                });
                            }
                            else {
                                actions.setSubmitting(false);
                                this.setState({ error: "Transaction failed", successState: 0 });
                            }
                        }).catch((reason: any) => {
                            actions.setSubmitting(false);
                            this.setState({error: reason.message, successState: 0});
                        });
                    }}
                >

                    {({
                        values,
                        isSubmitting,
                        touched,
                        isValid
                        /*errors,
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
                                            <ErrorMessage name="itemFile" children={this.errorDisplay}/>
                                            {touched.itemFile && this.state.modelLimitWarning && <small className="bg-warning text-dark rounded-1 my-1 p-1">
                                                <i className="bi bi-exclamation-triangle-fill"></i> {this.state.modelLimitWarning}</small>}
                                        </div>
                                        <div className="mb-3">
                                            <label htmlFor="itemTitle" className="form-label">Title</label>
                                            <Field id="itemTitle" name="itemTitle" type="text" className="form-control" disabled={isSubmitting} />
                                            <ErrorMessage name="itemTitle" children={this.errorDisplay}/>
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
                                            <ErrorMessage name="itemAmount" children={this.errorDisplay}/>
                                        </div>
                                        <div className="mb-3">
                                            <label htmlFor="itemRoyalties" className="form-label">Royalties</label>
                                            <div className="input-group">
                                                <span className="input-group-text">%</span>
                                                <Field id="itemRoyalties" name="itemRoyalties" type="number" className="form-control" aria-describedby="royaltiesHelp" disabled={isSubmitting} />
                                            </div>
                                            <div id="royaltiesHelp" className="form-text">The royalties you earn for this Item. 0 - 25%.</div>
                                            <ErrorMessage name="itemRoyalties" children={this.errorDisplay}/>
                                        </div>
                                        <button type="submit" className={`btn btn-${triHelper(this.state.successState, "primary", "danger", "success")} mb-3`} disabled={isSubmitting || !isValid}>
                                            {isSubmitting && <span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>} mint Item
                                        </button><br/>
                                        {this.state.error && ( <small className='text-danger'>Minting Item failed: {this.state.error}</small> )}
                                    </div>
                                    <div className='col'>
                                        <ModelPreview file={values.itemFile} ref={this.modelPreviewRef} modelLoaded={this.modelLoaded} />
                                        <div className='bg-info bg-warning p-3 text-dark rounded small mb-2'>Please be respectful of other's property :)</div>
                                    </div>
                                </div>
                            </Form>
                        )
                    }}
                </Formik>
            </div>
        );
    }
};
