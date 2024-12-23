import React from 'react';
import { Formik, Form, Field, FormikErrors,
    ErrorMessage, FormikProps } from 'formik';
import CustomFileUpload from './CustomFileUpload'
import ModelPreview, { ModelLoadingState } from './ModelPreview'
import Contracts from '../tz/Contracts'
import { getFileExt, isImageFile } from '../utils/Utils';
import TezosWalletContext from '../components/TezosWalletContext';
import { validateAddress, ValidationResult } from '@taquito/utils';
import Conf from '../Config';
import AppSettings from '../storage/AppSettings';
import { Trilean, triHelper } from './FormUtils';
import { TagPreview } from '../components/TagPreview';
import { Col, Container, Row } from 'react-bootstrap';
import { grapphQLUser } from '../graphql/user';
import { GetUserCollectionsQuery } from '../graphql/generated/user';
import { Logging } from '../utils/Logging';
import { Royalties } from '../components/Royalties';
import MintFormUitls from './MintFormUtils';
import { assert } from '../utils/Assert';


type MintFormProps = {
    closable?: boolean;
    closeForm(): void;
}

type MintFormState = {
    error: string,
    userCollections?: GetUserCollectionsQuery,
    successState: Trilean,
    modelLoadingState: ModelLoadingState;
    modelLimitWarning: string;
    modelMintDate: Date;
}

export class MintFrom extends React.Component<MintFormProps, MintFormState> {
    private initialValues: MintFormUitls.MintFormValues = {
        collection: Conf.item_contract,
        itemTitle: "",
        itemDescription: "",
        itemTags: "",
        itemAmount: 1,
        itemRoyalties: [],
        frameRatio: 0.02,
        frameColor: '#555555'
    };
    private modelPreviewRef = React.createRef<ModelPreview>();
    private formikRef = React.createRef<FormikProps<MintFormUitls.MintFormValues>>();
    private isClosable: boolean;

    private closeTimeout: NodeJS.Timeout | null = null;

    static override contextType = TezosWalletContext;
    declare context: React.ContextType<typeof TezosWalletContext>;
    
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

    private updateUserCollections() {
        // Fetch user collections, if wallet is connected.
        if (this.context.isWalletConnected()) {
            grapphQLUser.getUserCollections({address: this.context.walletPHK()}).then(res => {
                this.setState({userCollections: res});
            }).catch(reason => Logging.WarnDev("Fetching user collections failed:", reason));
        }
    }

    private resetRoyaltiesOnWalletChange() {
        assert(this.formikRef.current);
        // reset the form royalties default values
        this.formikRef.current.values.itemRoyalties = (this.context.isWalletConnected()) ? [[this.context.walletPHK(), 10]] : [];
    }

    private walletChangeListener = () => {
        this.updateUserCollections();

        this.resetRoyaltiesOnWalletChange();
    }

    override componentDidMount() {
        this.context.walletEvents().addListener("walletChange", this.walletChangeListener);

        this.resetRoyaltiesOnWalletChange();

        this.updateUserCollections();
    }

    override componentWillUnmount() {
        this.context.walletEvents().removeListener("walletChange", this.walletChangeListener);

        if(this.closeTimeout) clearTimeout(this.closeTimeout);
    }

    private errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    private modelLoaded = (loadingState: ModelLoadingState, modelFileSize: number, polyCount: number) => {
        const validateCallback = () => {
            assert(this.formikRef.current);
            this.formikRef.current.validateField("itemFile");
        }

        // Model limits warning
        if(loadingState === "success") {
            let modelLimitWarnings: string[] = [];
            if(polyCount > AppSettings.triangleLimit.defaultValue)
                modelLimitWarnings.push('Exceeds default World triangle limit. It may not be displayed.');

            if(polyCount > AppSettings.triangleLimitInterior.defaultValue)
                modelLimitWarnings.push('Exceeds default Interior triangle limit. It may not be displayed.');

            if(modelFileSize > AppSettings.fileSizeLimit.defaultValue)
                modelLimitWarnings.push('Exceeds default World file size limit. It may not be displayed.');

            if(modelFileSize > AppSettings.fileSizeLimitInterior.defaultValue)
                modelLimitWarnings.push('Exceeds default Interior file size limit. It may not be displayed.');

            this.setState({ modelLimitWarning: modelLimitWarnings.join('\n'), modelLoadingState: loadingState }, validateCallback);
        }
        else this.setState({ modelLimitWarning: "", modelLoadingState: loadingState }, validateCallback);
    }

    private async uploadAndMint(values: MintFormUitls.MintFormValues, callback?: (completed: boolean) => void) {
        assert(this.modelPreviewRef.current);

        // Get thumbnail and display images.
        const thumbnail = await this.modelPreviewRef.current.getThumbnail(MintFormUitls.ThumbnailImageRes);
        const display = await this.modelPreviewRef.current.getThumbnail(MintFormUitls.DisplayImageRes);

        const metadata = await MintFormUitls.formValuesToItemTokenMetadata(values, this.context.walletPHK(), this.modelPreviewRef.current.state.polycount,
            this.state.modelMintDate, thumbnail, display, this.modelPreviewRef.current.state.frameParams);

        let data;
        try {
            // Post here and wait for result
            const requestOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(metadata)
            };
            const response = await fetch(Conf.backend_url + "/upload", requestOptions);
            data = await response.json();
        }
        catch(e) {
            Logging.Error("Failed to upload metadata: ", e);
            throw new Error("Failed to upload metadata");
        }

        if(data.error) {
            throw new Error("Upload failed: " + data.error);
        }
        else if (data.metdata_uri && data.cid) {
            // mint item.
            await Contracts.mintItem(this.context, values.collection, data.metdata_uri, values.itemRoyalties, values.itemAmount, callback);
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
                            {this.isClosable && <button type='button' className='btn btn btn-primary' onClick={() => this.props.closeForm()}>Close</button>}
                        </div>
                    </div>
                </div> :
                <div>
                    {this.isClosable && <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => this.props.closeForm()} />}
                    <h2>mint Item</h2>
                    <Formik
                        innerRef={this.formikRef}
                        initialValues={this.initialValues}
                        validate = {(values) => {
                            assert(this.modelPreviewRef.current);

                            const errors: FormikErrors<MintFormUitls.MintFormValues> = {};

                            if (values.collection.length === 0) {
                                errors.itemTitle = 'Invalid collection';
                            }

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
                                errors.itemTitle = 'Title required.';
                            } else if (values.itemTitle.length > 100) {
                                errors.itemTitle = 'Title must be <= 100 characters.';
                            }

                            let total_royalties = 0;
                            let address_set = new Set<string>()
                            for (const [address, royalties] of values.itemRoyalties) {
                                total_royalties += royalties;

                                if (royalties < 0) {
                                    errors.itemRoyalties = `Royalties invalid: ${royalties}.`;
                                }

                                if (address_set.has(address)) {
                                    errors.itemRoyalties = `Adresses in royalties must be unique: '${address}'.`;
                                }

                                address_set.add(address);

                                if (validateAddress(address) !== ValidationResult.VALID) {
                                    errors.itemRoyalties = `Address invalid: '${address}'`;
                                }
                            }

                            if (total_royalties > 25) {
                                errors.itemRoyalties = 'Royalties invalid. Total must be less or equal 25%.';
                            }

                            if (values.itemAmount < 1 || values.itemAmount > 10000) {
                                errors.itemAmount = 'Amount invalid.';
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
                                            this.props.closeForm();
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
                                    <Container className='mx-0 px-0'>
                                        <Row>
                                            <Col md='7'>
                                                <div className="mb-3">
                                                    <label htmlFor="collection" className="form-label">Collection</label>
                                                    <Field id="collection" name="collection" as="select" value={values.collection} className="form-select" aria-describedby="collectionHelp" disabled={isSubmitting} >
                                                        <option key={Conf.item_contract} value={Conf.item_contract}>Public Items Collection</option>
                                                        {this.state.userCollections && this.state.userCollections.holder[0].collections.map(val =>
                                                            <option key={val.address} value={val.address}>{val.metadata!.name}</option>)}
                                                    </Field>
                                                    <div id="collectionHelp" className="form-text">The collection to mint in.</div>
                                                </div>
                                                <div className="mb-3">
                                                    <label htmlFor="itemFile" className="form-label">3D Model/Image file</label>
                                                    <Field id="itemFile" name="itemFile" className="form-control" aria-describedby="fileHelp" component={CustomFileUpload} disabled={isSubmitting} />
                                                    <div id="fileHelp" className="form-text">
                                                        Only glb models are supported. Self-contained gltf files will work, too.<br/>
                                                        Image formats supported: png, jpeg.<br/>
                                                        Current (default, soft) limit: {AppSettings.triangleLimit.defaultValue}/{AppSettings.triangleLimitInterior.defaultValue} triangles, {AppSettings.fileSizeLimit.defaultValue / 1024 / 1024}/{AppSettings.fileSizeLimitInterior.defaultValue / 1024 / 1024} Mb
                                                    </div>
                                                    <ErrorMessage name="itemFile" children={this.errorDisplay}/>
                                                    {touched.itemFile && this.state.modelLimitWarning && <small className="bg-warning text-dark rounded-1 my-1 p-1" style={{whiteSpace: "pre"}}>
                                                        <i className="bi bi-exclamation-triangle-fill"></i> {this.state.modelLimitWarning}</small>}
                                                </div>
                                                <Container className='mx-0 px-0 mb-3'>
                                                    <Row className='gx-3'>
                                                        <Col sm='12' md='7'>
                                                            <label htmlFor="itemTitle" className="form-label">Title</label>
                                                            <Field id="itemTitle" name="itemTitle" type="text" className="form-control" disabled={isSubmitting} />
                                                            <div id="itemTitleHelp" className="form-text">Name/title of the minted item.</div>
                                                            <ErrorMessage name="itemTitle" children={this.errorDisplay}/>
                                                        </Col>
                                                        <Col sm='12' md='5'>
                                                            <label htmlFor="itemAmount" className="form-label">Amount</label>
                                                            <Field id="itemAmount" name="itemAmount" type="number" min={1} max={10000} className="form-control" aria-describedby="itemAmountHelp" disabled={isSubmitting} />
                                                            <div id="itemAmountHelp" className="form-text">Number of Items minted.</div>
                                                            <ErrorMessage name="itemAmount" children={this.errorDisplay}/>
                                                        </Col>
                                                    </Row>
                                                </Container>
                                                <div className="mb-3">
                                                    <label htmlFor="itemDescription" className="form-label">Description</label>
                                                    <Field id="itemDescription" name="itemDescription" component="textarea" rows={2} className="form-control" disabled={isSubmitting} />
                                                    <ErrorMessage name="itemDescription" children={this.errorDisplay}/>
                                                </div>
                                                <div className="mb-3">
                                                    <label htmlFor="itemTags" className="form-label">Tags</label>
                                                    <TagPreview tags={values.itemTags}/>
                                                    <Field id="itemTags" name="itemTags" type="text" className="form-control" aria-describedby="tagsHelp" disabled={isSubmitting} />
                                                    <div id="tagsHelp" className="form-text">List of tags, separated by <b>;</b>.</div>
                                                </div>
                                                {values.itemFile && isImageFile(getFileExt(values.itemFile.name)) && 
                                                    <Container className='mx-0 px-0 mb-3'>
                                                        <Row className='gx-3'>
                                                            <Col sm='12' md='6'>
                                                                <label htmlFor="frameColor" className="form-label">Frame color</label>
                                                                <Field id="frameColor" name="frameColor" type="color" className="form-control" aria-describedby="frameColorHelp" style={{height: "2.4rem"}} disabled={isSubmitting} />
                                                                <div id="frameColorHelp" className="form-text">Color of the frame.</div>
                                                                <ErrorMessage name="frameColor" children={this.errorDisplay}/>
                                                            </Col>
                                                            <Col sm='12' md='6'>
                                                                <label htmlFor="frameRatio" className="form-label">Frame ratio</label>
                                                                <Field id="frameRatio" name="frameRatio" type="number" min="0" max="0.5" step="0.01" className="form-control" aria-describedby="frameRatioHelp" disabled={isSubmitting} />
                                                                <div id="frameRatioHelp" className="form-text">Ratio of frame to image.</div>
                                                                <ErrorMessage name="frameRatio" children={this.errorDisplay}/>
                                                            </Col>
                                                        </Row>
                                                    </Container>}
                                                <div className="mb-3">
                                                    <label htmlFor="itemRoyalties" className="form-label">Royalties</label>
                                                    <Field id="itemRoyalties" name="itemRoyalties" component={Royalties} rows={2} className="form-control" disabled={isSubmitting} />
                                                    {/*<div id="royaltiesHelp" className="form-text">The royalties for this Item. 0 - 25%.</div>*/}
                                                    <ErrorMessage name="itemRoyalties" children={this.errorDisplay}/>
                                                </div>
                                                <button type="submit" className={`btn btn-${triHelper(this.state.successState, "danger", "primary", "success")} mb-3`} disabled={isSubmitting || !isValid}>
                                                    {isSubmitting && <span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>} mint Item
                                                </button><br/>
                                                {this.state.error && ( <small className='text-danger'>Minting Item failed: {this.state.error}</small> )}
                                            </Col>
                                            <Col md='5'>
                                                <ModelPreview file={values.itemFile} frameColor={values.frameColor} frameRatio={values.frameRatio} ref={this.modelPreviewRef} width={350} height={350} modelLoaded={this.modelLoaded} bgColorSelection={true} />
                                                <div className='bg-info bg-info p-3 text-dark rounded small mb-2'>The image will be used for the preview thumbnail.<br/>
                                                    Use the mouse to control the view.<br/><br/>
                                                    Mouse wheel: zoom<br/>
                                                    Left mouse: rotate<br/>
                                                    Right mouse: pan</div>
                                                <div className='bg-info bg-warning p-3 text-dark rounded small mb-2'>🟢 Please be polite and treat everyone with respect!<br/>
                                                    ⛔ No copyminting, spamming, NSFW content, harassment, doxxing, FUD, etc.<br/><br/>
                                                    Rule violations are subject to being moderated.</div>
                                            </Col>
                                        </Row>
                                    </Container>
                                </Form>
                            )
                        }}
                    </Formik>
                </div>}
            </div>
        );
    }
};
