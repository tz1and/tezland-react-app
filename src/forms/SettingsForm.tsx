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
    displayPlaceBounds: boolean;
    drawDistance: number
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
        polygonLimit: AppSettings.getPolygonLimit(),
        displayPlaceBounds: AppSettings.getDisplayPlaceBounds(),
        drawDistance: AppSettings.getDrawDistance(),
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

                    if (values.drawDistance < 50) {
                        errors.drawDistance = 'Draw distance invalid';
                    }
                  
                    return errors;
                }}
                onSubmit={(values, actions) => {
                    try {
                        AppSettings.setPolygonLimit(values.polygonLimit);
                        AppSettings.setDisplayPlaceBounds(values.displayPlaceBounds);
                        AppSettings.setDrawDistance(values.drawDistance);

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
                            <div className="mb-3">
                                <label htmlFor="polygonLimit" className="form-label">Polygon limit</label>
                                <Field id="polygonLimit" name="polygonLimit" type="number" className="form-control" aria-describedby="polygonLimitHelp" disabled={isSubmitting} autoFocus={true} />
                                <div id="polygonLimitHelp" className="form-text">Items with more polygons than the limit will not be displayed.</div>
                                {touched.polygonLimit && errors.polygonLimit && <small className="text-danger">{errors.polygonLimit}</small>}
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
