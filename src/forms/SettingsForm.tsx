import React from 'react';
import {
    Formik,
    Form,
    Field,
    FormikErrors
} from 'formik';
import AppSettings from '../storage/AppSettings';

interface SettingsFormValues {
    /*itemTitle: string;
    itemDescription: string;
    itemTags: string;*/
    polygonLimit: number;
    modelFileSizeLimit: number; // in MB
    displayPlaceBounds: boolean;
    drawDistance: number;
    showFps: boolean;
    mouseSensitivity: number;
    //itemFile: ArrayBuffer;
}

type SettingsFormProps = {
    closeForm(cancelled: boolean): void;
}

type SettingsFormState = {
    error: string
}


export const SettingsForm: React.FC<SettingsFormProps> = (props) => {
    const state: SettingsFormState = { error: "" }
    const initialValues: SettingsFormValues = {
        polygonLimit: AppSettings.polygonLimit.value,
        modelFileSizeLimit: AppSettings.fileSizeLimit.value / 1024 / 1024, // should be in MB
        displayPlaceBounds: AppSettings.displayPlaceBounds.value,
        drawDistance: AppSettings.drawDistance.value,
        showFps: AppSettings.showFps.value,

        // controls
        mouseSensitivity: AppSettings.mouseSensitivity.value
    };

    return (
        <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
            <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={() => props.closeForm(true)} />
            <h2>settings</h2>
            <Formik
                initialValues={initialValues}
                validate = {(values) => {
                    const errors: FormikErrors<SettingsFormValues> = {};

                    if (values.polygonLimit < 1000) {
                        errors.polygonLimit = 'Polygon limit invalid';
                    }

                    if (values.modelFileSizeLimit < 1) {
                        errors.modelFileSizeLimit = 'Model file size invalid';
                    }

                    if (values.drawDistance < 50) {
                        errors.drawDistance = 'Draw distance invalid';
                    }
                  
                    return errors;
                }}
                onSubmit={(values, actions) => {
                    try {
                        AppSettings.polygonLimit.value = values.polygonLimit;
                        AppSettings.fileSizeLimit.value = parseInt((values.modelFileSizeLimit * 1024 * 1024).toFixed(0));
                        AppSettings.displayPlaceBounds.value = values.displayPlaceBounds;
                        AppSettings.drawDistance.value = values.drawDistance;
                        AppSettings.showFps.value = values.showFps;

                        AppSettings.mouseSensitivity.value = values.mouseSensitivity;

                        props.closeForm(false);

                        return;
                    }
                    catch(e: any) {
                        state.error = e.message;
                    }

                    actions.setSubmitting(false);
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
                            <ul className="nav nav-tabs" id="myTab" role="tablist">
                                <li className="nav-item" role="presentation">
                                    <button className="nav-link active" id="general-tab" data-bs-toggle="tab" data-bs-target="#general" type="button" role="tab" aria-controls="general" aria-selected="true">General</button>
                                </li>
                                <li className="nav-item" role="presentation">
                                    <button className="nav-link" id="controls-tab" data-bs-toggle="tab" data-bs-target="#controls" type="button" role="tab" aria-controls="controls" aria-selected="false">Controls</button>
                                </li>
                            </ul>
                            <div className="tab-content" id="myTabContent">
                                <div className="tab-pane fade show active" id="general" role="tabpanel" aria-labelledby="general-tab">
                                <div className="mb-3">
                                    <label htmlFor="polygonLimit" className="form-label">Polygon limit</label>
                                    <Field id="polygonLimit" name="polygonLimit" type="number" className="form-control" aria-describedby="polygonLimitHelp" disabled={isSubmitting} autoFocus={true} />
                                    <div id="polygonLimitHelp" className="form-text">Items with more polygons than the limit will not be displayed.</div>
                                    {touched.polygonLimit && errors.polygonLimit && <small className="text-danger">{errors.polygonLimit}</small>}
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="modelFileSizeLimit" className="form-label">Model file size limit (in MiB)</label>
                                    <Field id="modelFileSizeLimit" name="modelFileSizeLimit" type="number" className="form-control" aria-describedby="modelFileSizeLimitHelp" disabled={isSubmitting} autoFocus={true} />
                                    <div id="modelFileSizeLimitHelp" className="form-text">Items models larger than this won't be displayed.</div>
                                    {touched.modelFileSizeLimit && errors.modelFileSizeLimit && <small className="text-danger">{errors.modelFileSizeLimit}</small>}
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="drawDistance" className="form-label">Draw distance</label>
                                    <Field id="drawDistance" name="drawDistance" type="number" className="form-control" aria-describedby="drawDistanceHelp" disabled={isSubmitting} />
                                    <div id="drawDistanceHelp" className="form-text">The draw distance, you know.</div>
                                    {touched.drawDistance && errors.drawDistance && <small className="text-danger">{errors.drawDistance}</small>}
                                </div>
                                <div className="mb-3">
                                    <Field id="displayPlaceBounds" name="displayPlaceBounds" type="checkbox" className="form-check-input me-2" aria-describedby="displayPlaceBoundsHelp" disabled={isSubmitting}/>
                                    <label htmlFor="displayPlaceBounds" className="form-label">Display place bounds</label>
                                    <div id="displayPlaceBoundsHelp" className="form-text">Whether place boundaries should be drawn or not.</div>
                                </div>
                                <div className="mb-3">
                                    <Field id="showFps" name="showFps" type="checkbox" className="form-check-input me-2" aria-describedby="showFpsHelp" disabled={isSubmitting}/>
                                    <label htmlFor="showFps" className="form-label">Show FPS</label>
                                    <div id="showFpsHelp" className="form-text">Show frames per second.</div>
                                </div>
                            </div>
                            <div className="tab-pane fade" id="controls" role="tabpanel" aria-labelledby="controls-tab">
                                <div className="mb-3">
                                    <label htmlFor="mouseSensitivity" className="form-label">Mouse Sensitivity</label>
                                    <Field id="mouseSensitivity" name="mouseSensitivity" type="number" step={0.1} className="form-control" aria-describedby="mouseSensitivityHelp" disabled={isSubmitting} autoFocus={true} />
                                    <div id="mouseSensitivityHelp" className="form-text">How sensitive mouse look is.</div>
                                    {touched.mouseSensitivity && errors.mouseSensitivity && <small className="text-danger">{errors.mouseSensitivity}</small>}
                                </div>
                                </div>
                            </div>
                            {state.error.length > 0 && ( <small className='text-danger'>Saving settings failed: {state.error}</small> )}
                            <button type="submit" className="btn btn-primary mb-3" disabled={isSubmitting || !isValid}>save settings</button>
                            <div className='bg-info bg-gradient p-2 text-dark rounded small text-center'>Note: You may have to reload after changing settings.</div>
                        </Form>
                    )
                }}
            </Formik>
        </div>
    );
};
