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
import { dataURItoBlob, FileLike, fileToFileLike, getFileType, RefLike } from '../utils/Utils';
import TezosWalletContext from '../components/TezosWalletContext';
import Conf from '../Config';
import AppSettings from '../storage/AppSettings';
import { Trilean, triHelper } from './FormUtils';
import { decode, DecodedPng } from 'fast-png';
import assert from 'assert';

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
    successState: Trilean,
    modelLoadingState: ModelLoadingState;
    modelLimitWarning: string;
    modelMintDate: Date;
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
            successState: 0,
            modelLoadingState: "none",
            modelLimitWarning: "",
            modelMintDate: new Date()
        };

        this.isClosable = this.props.closable === undefined ? true : this.props.closable;
    }

    override componentWillUnmount() {
        if(this.closeTimeout) clearInterval(this.closeTimeout);
    }

    private errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    private modelLoaded = (loadingState: ModelLoadingState, modelFileSize: number, polyCount: number) => {
        const validateCallback = () => {
            assert(this.formikRef.current);
            this.formikRef.current.validateField("itemFile");
        }

        // Model limits warning
        if(loadingState === "success") {
            let modelLimitWarning = '';
            if(polyCount > AppSettings.triangleLimit.defaultValue)
                modelLimitWarning = 'Exceeds default triangle limit. It may not be displayed.';

            if(modelFileSize > AppSettings.fileSizeLimit.defaultValue)
                modelLimitWarning = 'Exceeds default file size limit. It may not be displayed.';

            this.setState({ modelLimitWarning: modelLimitWarning, modelLoadingState: loadingState }, validateCallback);
        }
        else this.setState({ modelLimitWarning: "", modelLoadingState: loadingState }, validateCallback);
    }

    private static checkImageValid(image: DecodedPng, w: number, h: number, title: string) {
        // check channels.
        if (image.channels < 3) throw new Error(`Invalid ${title} image: num channels < 3`);

        // check resolution.
        if (image.width !== w) throw new Error(`Invalid ${title} image: wrong width`);
        if (image.height !== h) throw new Error(`Invalid ${title} image: wrong height`);

        // Check most pixels aren't 0!
        let zero_count = 0;
        for (let i = 0; i < image.data.length; ++i) {
            if(image.data[i] === 0) ++zero_count;
        }
        if (zero_count > image.data.length / 3) throw new Error(`Invalid ${title} image: data mostly empty`);
    }

    private async uploadAndMint(values: MintFormValues, callback?: (completed: boolean) => void) {
        assert(values.itemFile);
        assert(this.modelPreviewRef.current);

        // TEMP: don't check this for images, etc:
        // For some meshes (fox) you can't count the polygons...
        assert(this.modelPreviewRef.current.state.polycount >= 0);

        // Get thumbnail and check it's valid.
        const thumbnailRes = 350;
        const thumbnail = await this.modelPreviewRef.current.getThumbnail(thumbnailRes);
        const decoded_thumbnail = decode(await dataURItoBlob(thumbnail).arrayBuffer());
        MintFrom.checkImageValid(decoded_thumbnail, thumbnailRes, thumbnailRes, "thumbnail");

        // Get display and check it's valid.
        const displayRes = 1000;
        const display = await this.modelPreviewRef.current.getThumbnail(displayRes);
        const decoded_display = decode(await dataURItoBlob(display).arrayBuffer());
        MintFrom.checkImageValid(decoded_display, displayRes, displayRes, "display");

        // TODO: validate mimeType in validation.
        var mime_type;
        const file_type = await getFileType(values.itemFile);
        if(file_type === "glb") mime_type = "model/gltf-binary";
        else if(file_type === "gltf") mime_type = "model/gltf+json";
        else throw new Error("Unsupported mimeType");

        const metadata = createItemTokenMetadata({
            name: values.itemTitle,
            description: values.itemDescription,
            date: this.state.modelMintDate,
            minter: this.context.walletPHK(),
            artifactUri: await fileToFileLike(values.itemFile, mime_type),
            displayUri: { dataUri: display, type: "image/png", name: "display.png" } as FileLike,
            thumbnailUri: { dataUri: thumbnail, type: "image/png", name: "thumbnail.png" } as FileLike,
            tags: values.itemTags,
            formats: [
                {
                    uri: { topLevelRef: "artifactUri" } as RefLike,
                    mimeType: mime_type,
                    fileSize: values.itemFile.size,
                    fileName: values.itemFile.name,
                },
                {
                    uri: { topLevelRef: "displayUri" } as RefLike,
                    mimeType: "image/png",
                    fileName: "display.png",
                    dimensions: {
                        "value": displayRes + "x" + displayRes,
                        "unit": "px"
                    }
                },
                {
                    uri: { topLevelRef: "thumbnailUri" } as RefLike,
                    mimeType: "image/png",
                    fileName: "thumbnail.png",
                    dimensions: {
                        "value": thumbnailRes + "x" + thumbnailRes,
                        "unit": "px"
                    }
                }
            ],
            baseScale: 1,
            polygonCount: this.modelPreviewRef.current.state.polycount
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

    private resetState() {
        this.setState({
            error: "",
            successState: 0,
            modelLoadingState: "none",
            modelLimitWarning: "",
            modelMintDate: new Date()
        });
    }

    override render(): React.ReactNode {
        return (
            <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
                {this.state.successState === 1 ? <div><h2 className='mb-2'>Item minted</h2>
                    <div className='d-flex align-items-center justify-content-center'>
                        <div className='btn-group' role='group'>
                            <button type='button' className='btn btn btn-success' onClick={() => this.resetState()}>Mint another</button>
                            {this.isClosable && <button type='button' className='btn btn btn-primary' onClick={() => this.props.closeForm(true)}>Close</button>}
                        </div>
                    </div>
                </div> :
                <div>
                    {this.isClosable && <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => this.props.closeForm(true)} />}
                    <h2>mint Item</h2>
                    <Formik
                        innerRef={this.formikRef}
                        initialValues={this.initialValues}
                        validate = {(values) => {
                            assert(this.modelPreviewRef.current);

                            const errors: FormikErrors<MintFormValues> = {};

                            if (!values.itemFile) {
                                errors.itemFile = 'No file selected';
                            } else {
                                // this is "delayed" because it depends on async state...
                                // TODO: improve, somehow.
                                if(this.state.modelLoadingState === "failed")
                                    errors.itemFile = 'Model file failed to load.';

                                // This is just here to filter out some obvious trolls.
                                if (this.modelPreviewRef.current.state.polycount > 10000000)
                                    errors.itemFile = 'Mesh has too many triangles.';
                            }

                            if (values.itemDescription.length > 1000) {
                                errors.itemDescription = 'Description must be <= 1000 characters.';
                            }

                            if (values.itemTitle.length === 0) {
                                errors.itemTitle = 'Title required';
                            } else if (values.itemTitle.length > 100) {
                                errors.itemTitle = 'Title must be <= 100 characters.';
                            }
                        
                            if (values.itemRoyalties < 0 || values.itemRoyalties > 25) {
                                errors.itemRoyalties = 'Royalties invalid';
                            }

                            if (values.itemAmount < 1 || values.itemAmount > 10000) {
                                errors.itemAmount = 'Amount invalid';
                            }

                            // revalidation clears trisate and error
                            this.setState({error: "", successState: 0});
                        
                            return errors;
                        }}
                        onSubmit={(values, actions) => {
                            this.uploadAndMint(values, (completed: boolean) => {
                                if (completed) {
                                    if(!this.isClosable) actions.setSubmitting(false);

                                    this.setState({error: "", successState: 1}, /*() => {
                                        // If closable close form after a short time.
                                        if(this.isClosable) this.closeTimeout = setTimeout(() => {
                                            this.props.closeForm(false);
                                        }, 1000);
                                    }*/);
                                }
                                else {
                                    actions.setSubmitting(false);
                                    this.setState({ error: "Transaction failed", successState: -1 });
                                }
                            }).catch((reason: any) => {
                                actions.setSubmitting(false);
                                this.setState({error: reason.message, successState: -1});
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
                                                <div id="fileHelp" className="form-text">Only glb models are supported.<br/>Self-contained gltf files will also work.<br/>
                                                Current (default, soft) limit: {AppSettings.triangleLimit.defaultValue} triangles, {AppSettings.fileSizeLimit.defaultValue / 1024 / 1024} Mb</div>
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
                                                <ErrorMessage name="itemDescription" children={this.errorDisplay}/>
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
                                            <button type="submit" className={`btn btn-${triHelper(this.state.successState, "danger", "primary", "success")} mb-3`} disabled={isSubmitting || !isValid}>
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
                </div>}
            </div>
        );
    }
};
