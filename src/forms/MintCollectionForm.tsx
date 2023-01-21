import React from 'react';
import { Formik, Form, Field, FormikErrors,
    ErrorMessage, FormikProps } from 'formik';
import { CollectionMetadata, processTags } from '../ipfs/ipfs';
import TezosWalletContext from '../components/TezosWalletContext';
import Conf from '../Config';
import { Trilean, triHelper } from './FormUtils';
import { TagPreview } from '../components/TagPreview';
import Collections from '../tz/Collections';

interface MintCollectionFormValues {
    collectionName: string;
    collectionDescription: string;
    collectionTags: string;
}

type MintCollectionFormProps = {
    closable?: boolean;
    closeForm(): void;
}

type MintFormState = {
    error: string;
    successState: Trilean;
    collectionMintDate: Date;
}

const CollectionMetadataDefaults = {
    interfaces: [ "TZIP-012", "TZIP-016" ],
    description: "A tz1and private Item collection.\n\nBased on the SmartPy FA2 implementation.",
    version: "1.0.0",
    authors: [ "852Kerfunkle <https://github.com/852Kerfunkle>", "SmartPy <https://smartpy.io/#contact>" ],
    homepage: "https://www.tz1and.com",
    source: { "tools": [ "SmartPy" ], "location": "https://github.com/tz1and" },
    license: { "name": "MIT" },
    permissions: { "receiver": "owner-no-hook", "sender": "owner-no-hook", "operator": "pauseable-owner-or-operator-transfer" }
}

export class MintCollectionForm extends React.Component<MintCollectionFormProps, MintFormState> {
    private initialValues: MintCollectionFormValues = { collectionName: "", collectionDescription: "", collectionTags: "" };
    private formikRef = React.createRef<FormikProps<MintCollectionFormValues>>();
    private isClosable: boolean;

    private closeTimeout: NodeJS.Timeout | null = null;

    static override contextType = TezosWalletContext;
    declare context: React.ContextType<typeof TezosWalletContext>;
    
    constructor(props: MintCollectionFormProps) {
        super(props);
        this.state = {
            error: "",
            successState: 0,
            collectionMintDate: new Date()
        };

        this.isClosable = this.props.closable === undefined ? true : this.props.closable;
    }

    override componentWillUnmount() {
        if(this.closeTimeout) clearTimeout(this.closeTimeout);
    }

    private errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    private async uploadAndMint(values: MintCollectionFormValues, callback?: (completed: boolean) => void) {
        const metadata: CollectionMetadata = {
            name: values.collectionName,
            userDescription: values.collectionDescription,
            date: this.state.collectionMintDate.toISOString(),
            minter: this.context.walletPHK(),
            tags: processTags(values.collectionTags),
            ...CollectionMetadataDefaults
        };

        // Post here and wait for result
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metadata)
        };
        const response = await fetch(Conf.backend_url + "/upload", requestOptions)
        const data = await response.json();

        if(data.error) {
            throw new Error("Upload failed: " + data.error);
        }
        else if (data.metdata_uri && data.cid) {
            // mint item.
            await Collections.mintCollection(this.context, data.metdata_uri, callback);
        }
        else throw new Error("Backend: malformed response");
    }

    private resetState() {
        this.setState({
            error: "",
            successState: 0,
            collectionMintDate: new Date()
        });
    }

    override render(): React.ReactNode {
        return (
            <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
                {this.state.successState === 1 ? <div><h2 className='mb-2'>Collection minted</h2>
                    <div className='d-flex align-items-center justify-content-center'>
                        <div className='btn-group' role='group'>
                            <button type='button' className='btn btn btn-success' onClick={() => this.resetState()}>Mint another</button>
                            {this.isClosable && <button type='button' className='btn btn btn-primary' onClick={() => this.props.closeForm()}>Close</button>}
                        </div>
                    </div>
                </div> :
                <div>
                    {this.isClosable && <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => this.props.closeForm()} />}
                    <h2>mint Collection</h2>
                    <Formik
                        innerRef={this.formikRef}
                        initialValues={this.initialValues}
                        validate = {(values) => {
                            const errors: FormikErrors<MintCollectionFormValues> = {};

                            // TODO: validate name and description

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
                                    <div className='row'>
                                        <div className='col'>
                                            <div className="mb-3">
                                                <label htmlFor="collectionName" className="form-label">Title</label>
                                                <Field id="collectionName" name="collectionName" type="text" className="form-control" disabled={isSubmitting} />
                                                <ErrorMessage name="collectionName" children={this.errorDisplay}/>
                                            </div>
                                            <div className="mb-3">
                                                <label htmlFor="collectionDescription" className="form-label">Description</label>
                                                <Field id="collectionDescription" name="collectionDescription" component="textarea" rows={2} className="form-control" disabled={isSubmitting} />
                                                <ErrorMessage name="collectionDescription" children={this.errorDisplay}/>
                                            </div>
                                            <div className="mb-3">
                                                <label htmlFor="collectionTags" className="form-label">Tags</label>
                                                <TagPreview tags={values.collectionTags}/>
                                                <Field id="collectionTags" name="collectionTags" type="text" className="form-control" aria-describedby="tagsHelp" disabled={isSubmitting} />
                                                <div id="tagsHelp" className="form-text">List of tags, separated by <b>;</b>.</div>
                                            </div>
                                            <div className="mb-3">
                                                Please note, that for now you won't be able to change the collection metadata. Will be added in the future.
                                            </div>
                                            <button type="submit" className={`btn btn-${triHelper(this.state.successState, "danger", "primary", "success")} mb-3`} disabled={isSubmitting || !isValid}>
                                                {isSubmitting && <span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>} mint Collection
                                            </button><br/>
                                            {this.state.error && ( <small className='text-danger'>Minting Collection failed: {this.state.error}</small> )}
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
