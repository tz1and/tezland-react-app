import React, { useState } from 'react';
import {
    Formik,
    Form,
    Field,
    FormikErrors,
    ErrorMessage
} from 'formik';
import Contracts from '../tz/Contracts';
import { useTezosWalletContext } from '../components/TezosWalletContext';
import { Trilean, triHelper } from './FormUtils';
import BasePlaceNode from '../world/nodes/BasePlaceNode';
import { getPlaceType, PlaceType } from '../utils/PlaceKey';
import { Vector3 } from '@babylonjs/core/Maths';
import PlaceProperties, { colorToBytes } from '../utils/PlaceProperties';
import { Button, ButtonToolbar, Col, Container, Row } from 'react-bootstrap';
import { MeshUtils } from '../utils/MeshUtils';
import { assert } from '../utils/Assert';


interface PlacePropertiesFormValues {
    placeGroundColor: string;
    placeName: string;
    // Interior only:
    interiorDisableFloor: boolean;
    interiorOverrideBackground: boolean;
    interiorBackgroundColor: string;
    interiorOverrideLightDir: boolean;
    interiorLightDirection: Vector3;
    interiorOverrideWaterLevel: boolean;
    interiorWaterLevel: number;
    // Maybe general again:
    overrideSpawnPos: boolean;
    spawnPosition: Vector3;
}

type PlacePropertiesFormProps = {
    place: BasePlaceNode;
}

type PlacePropertiesFormState = {
    error: string;
    successState: Trilean;
}

export const PlacePropertiesForm: React.FC<PlacePropertiesFormProps> = (props) => {
    const context = useTezosWalletContext();

    assert(props.place.placeData);
    const [state, setState] = useState<PlacePropertiesFormState>({error: "", successState: 0});
    const [placeProps] = useState<PlaceProperties>(new PlaceProperties(props.place.placeData.placeProps));

    const place_type = getPlaceType(props.place.placeKey.fa2);
    
    //const state: PlacePropertiesFormState = { error: "" }
    // 
    const initialValues: PlacePropertiesFormValues = {
        placeGroundColor: placeProps.placeGroundColor,
        placeName: placeProps.placeName || "",
        // Interior only:
        interiorDisableFloor: placeProps.interiorDisableFloor || false,
        // bg
        interiorOverrideBackground: placeProps.interiorBackgroundColor ? true : false,
        interiorBackgroundColor: placeProps.interiorBackgroundColor || '#cccccc',
        // light dir
        interiorOverrideLightDir: placeProps.interiorLightDirection ? true : false,
        interiorLightDirection: placeProps.interiorLightDirection || new Vector3(1,1,1),
        // water level
        interiorOverrideWaterLevel: placeProps.interiorWaterLevel ? true : false,
        interiorWaterLevel: placeProps.interiorWaterLevel || 10,
        // spawn pos
        overrideSpawnPos: placeProps.spawnPosition ? true : false,
        spawnPosition: placeProps.spawnPosition || new Vector3(0,0,0)
        //interiorSpawnLocation: // TODO: add a spawn location serialiser and parser to ItemDataParser/Writer
    };

    const errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    const updatePosition = (setFieldValue: (field: string, value: any, shouldValidate?: boolean) => void) => {
        assert(props.place.itemsNode);
        const relative_pos = props.place.world.game.playerController.getPosition().subtract(props.place.itemsNode.position);
        setFieldValue('spawnPosition', new Vector3(
            parseFloat(relative_pos.x.toFixed(2)),
            parseFloat(relative_pos.y.toFixed(2)),
            parseFloat(relative_pos.z.toFixed(2))
        ));
    }

    const previewChanges = (values: PlacePropertiesFormValues) => {
        updatePlacePropsFromFormValues(values);
        props.place.updateOnPlacePropChange(placeProps, false);
    }

    const updatePlacePropsFromFormValues = (values: PlacePropertiesFormValues) => {
        placeProps.placeGroundColor = values.placeGroundColor;
        placeProps.placeName = values.placeName !== "" ? values.placeName : null;
        placeProps.interiorDisableFloor = values.interiorDisableFloor ? true : null;
        placeProps.interiorBackgroundColor = values.interiorOverrideBackground ? values.interiorBackgroundColor : null;
        placeProps.interiorLightDirection = values.interiorOverrideLightDir ? values.interiorLightDirection : null;
        placeProps.interiorWaterLevel = values.interiorOverrideWaterLevel ? values.interiorWaterLevel : null;
        placeProps.spawnPosition = values.overrideSpawnPos ? values.spawnPosition : null;
    }

    return (
        <Formik
            initialValues={initialValues}
            validate = {(values) => {
                const errors: FormikErrors<PlacePropertiesFormValues> = {};

                const bytes = colorToBytes(values.placeGroundColor)
                if (bytes.length !== 6 /*|| not hex*/) {
                    errors.placeGroundColor = "Ground color invalid.";
                }

                if (values.placeName.length > 32) {
                    errors.placeName = "Place name is too long (max. 32 characters)."
                }

                if (place_type === PlaceType.Interior) {
                    // TODO validate interior settings
                    const bytes = colorToBytes(values.interiorBackgroundColor)
                    if (bytes.length !== 6 /*|| not hex*/) {
                        errors.interiorBackgroundColor = "Background color invalid.";
                    }

                    if (values.overrideSpawnPos) {
                        assert(props.place.placeBounds);
                        assert(props.place.itemsNode);
                        const absolute_pos = values.spawnPosition.add(props.place.itemsNode.position);
                        if(!MeshUtils.pointIsInside(absolute_pos, props.place.placeBounds))
                            errors.spawnPosition = "Spawn position is out of bounds.";
                    }

                    if (values.interiorOverrideWaterLevel) {
                        if (values.interiorWaterLevel < 0) {
                            errors.spawnPosition = "Water level must be >= 0.";
                        }
                    }
                }

                // revalidation clears trisate and error
                setState({error: "", successState: 0});
                
                return errors;
            }}
            onSubmit={(values, actions) => {
                // Update the PlaceProperties
                updatePlacePropsFromFormValues(values);

                const [changes, removals] = placeProps.getChangesAndRemovals();

                Contracts.savePlaceProps(context, changes, removals, props.place, (completed: boolean) => {
                    actions.setSubmitting(false);

                    if (completed)
                        setState({error: "", successState: 1});
                    else
                        setState({error: "Transaction failed", successState: -1});
                }).catch((reason: any) => {
                    actions.setSubmitting(false);
                    setState({error: reason.message, successState: -1});
                });
            }}
        >
            {({
                isSubmitting,
                isValid,
                values,
                setFieldValue
            }) => {
                return (
                    <Form className='mt-2'>
                        <div className="mb-3">
                            <label htmlFor="placeGroundColor" className="form-label">Ground color</label>
                            <Field id="placeGroundColor" name="placeGroundColor" type="color" className="form-control" aria-describedby="placeGroundColorHelp" style={{height: "3rem"}} disabled={isSubmitting} autoFocus={true} />
                            <div id="placeGroundColorHelp" className="form-text">You can change the ground color in your place.</div>
                            <ErrorMessage name="placeGroundColor" children={errorDisplay}/>
                        </div>

                        <div className="mb-3">
                            <label htmlFor="placeName" className="form-label">Place Name</label>
                            <Field id="placeName" name="placeName" type="text" className="form-control" aria-describedby="placeNameHelp" disabled={isSubmitting} />
                            <div id="placeNameHelp" className="form-text">The Place's name. Leave empty if you don't want to assign a custom name.</div>
                            <ErrorMessage name="placeName" children={errorDisplay}/>
                        </div>

                        {place_type === PlaceType.Interior && <div className="mb-3">
                            <Field id="interiorOverrideBackground" name="interiorOverrideBackground" type="checkbox" className="form-check-input me-2" aria-describedby="interiorBackgroundColorHelp" disabled={isSubmitting}/>
                            <label htmlFor="interiorOverrideBackground" className="form-label">Background color</label>

                            {/*<label htmlFor="interiorBackgroundColor" className="form-label">Background color</label>*/}
                            <Field id="interiorBackgroundColor" name="interiorBackgroundColor" type="color" className="form-control" aria-describedby="interiorBackgroundColorHelp" style={{height: "3rem"}} disabled={isSubmitting || !values.interiorOverrideBackground} autoFocus={true} />
                            <div id="interiorBackgroundColorHelp" className="form-text">You can change the background in your Interior to a uniform background color.</div>
                            <ErrorMessage name="interiorBackgroundColor" children={errorDisplay}/>
                        </div>}

                        {place_type === PlaceType.Interior && <div className="mb-3">
                            <Field id="interiorOverrideLightDir" name="interiorOverrideLightDir" type="checkbox" className="form-check-input me-2" aria-describedby="interiorLightDirectionHelp" disabled={isSubmitting}/>
                            <label htmlFor="interiorOverrideLightDir" className="form-label">Light direction</label>

                            {/*<label htmlFor="interiorLightDirection" className="form-label">Background color</label>*/}
                            <Container className='px-0'>
                                <Row className='gx-2'>
                                    <Col className='input-group'>
                                        <span className="input-group-text">X</span>
                                        <Field style={{maxWidth: "9rem"}} id="interiorLightDirection.x" name="interiorLightDirection.x" type="number" step={0.1} className="form-control" aria-describedby="interiorLightDirectionHelp" disabled={isSubmitting || !values.interiorOverrideLightDir} autoFocus={true} />
                                    </Col>
                                    <Col className='input-group'>
                                        <span className="input-group-text">Y</span>
                                        <Field style={{maxWidth: "9rem"}} id="interiorLightDirection.y" name="interiorLightDirection.y" type="number" step={0.1} className="form-control" aria-describedby="interiorLightDirectionHelp" disabled={isSubmitting || !values.interiorOverrideLightDir} autoFocus={true} />
                                    </Col>
                                    <Col className='input-group'>
                                        <span className="input-group-text">Z</span>
                                        <Field style={{maxWidth: "9rem"}} id="interiorLightDirection.z" name="interiorLightDirection.z" type="number" step={0.1} className="form-control" aria-describedby="interiorLightDirectionHelp" disabled={isSubmitting || !values.interiorOverrideLightDir} autoFocus={true} />
                                    </Col>
                                </Row>
                            </Container>
                            <div id="interiorLightDirectionHelp" className="form-text">You can change the light direction in your Interior. Y is up, values <i>should</i> be in the range [-1, 1].</div>
                            <ErrorMessage name="interiorLightDirection" children={errorDisplay}/>
                        </div>}

                        {place_type === PlaceType.Interior && <div className="mb-3">
                            <Field id="overrideSpawnPos" name="overrideSpawnPos" type="checkbox" className="form-check-input me-2" aria-describedby="spawnPositionHelp" disabled={isSubmitting}/>
                            <label htmlFor="overrideSpawnPos" className="form-label">Spawn position</label>

                            {/*<label htmlFor="spawnPosition" className="form-label">Background color</label>*/}
                            <Container className='px-0'>
                                <Row className='gx-2'>
                                    <Col className='input-group'>
                                        <span className="input-group-text">X</span>
                                        <Field style={{maxWidth: "9rem"}} id="spawnPosition.x" name="spawnPosition.x" type="number" step={0.1} className="form-control" aria-describedby="spawnPositionHelp" disabled={isSubmitting || !values.overrideSpawnPos} autoFocus={true} />
                                    </Col>
                                    <Col className='input-group'>
                                        <span className="input-group-text">Y</span>
                                        <Field style={{maxWidth: "9rem"}} id="spawnPosition.y" name="spawnPosition.y" type="number" step={0.1} className="form-control" aria-describedby="spawnPositionHelp" disabled={isSubmitting || !values.overrideSpawnPos} autoFocus={true} />
                                    </Col>
                                    <Col className='input-group'>
                                        <span className="input-group-text">Z</span>
                                        <Field style={{maxWidth: "9rem"}} id="spawnPosition.z" name="spawnPosition.z" type="number" step={0.1} className="form-control" aria-describedby="spawnPositionHelp" disabled={isSubmitting || !values.overrideSpawnPos} autoFocus={true} />
                                    </Col>
                                </Row>
                            </Container>
                            <div id="spawnPositionHelp" className="form-text">You can change the spawn position of your Interior.</div>
                            <Button variant='outline-primary' disabled={isSubmitting || !values.overrideSpawnPos} onClick={() => updatePosition(setFieldValue)}>Current position</Button>
                            <ErrorMessage name="spawnPosition" children={errorDisplay}/>
                        </div>}

                        {place_type === PlaceType.Interior && <div className="mb-3">
                            <Field id="interiorOverrideWaterLevel" name="interiorOverrideWaterLevel" type="checkbox" className="form-check-input me-2" aria-describedby="interiorWaterLevelHelp" disabled={isSubmitting}/>
                            <label htmlFor="interiorOverrideWaterLevel" className="form-label">Water level</label>
                            <Field id="interiorWaterLevel" name="interiorWaterLevel" type="number" className="form-control" aria-describedby="interiorWaterLevelHelp" disabled={isSubmitting || !values.interiorOverrideWaterLevel} />
                            <div id="interiorWaterLevelHelp" className="form-text">The Interiors water level, if any. 0 = ground level.</div>
                            <ErrorMessage name="interiorWaterLevel" children={errorDisplay}/>
                        </div>}

                        {place_type === PlaceType.Interior && <div className="mb-3">
                            <Field id="interiorDisableFloor" name="interiorDisableFloor" type="checkbox" className="form-check-input me-2" aria-describedby="interiorDisableFloorHelp" disabled={isSubmitting}/>
                            <label htmlFor="interiorDisableFloor" className="form-label">Disable ground</label>
                            <div id="interiorDisableFloorHelp" className="form-text">You can disable the ground in your Interior.</div>
                        </div>}

                        <ButtonToolbar className="justify-content-between">
                            <button type="submit" className={`btn btn-${triHelper(state.successState, "danger", "primary", "success")}`} disabled={isSubmitting || !isValid}>
                                {isSubmitting && (<span className="spinner-border spinner-grow-sm" role="status" aria-hidden="true"></span>)} save Place props</button><br/>
                            {state.error && ( <small className='text-danger d-inline-block mt-2'>Saving Place properties failed: {state.error}</small> )}
                            {place_type === PlaceType.Interior && <Button variant='outline-warning' disabled={isSubmitting} onClick={() => previewChanges(values)}>Preview</Button>}
                        </ButtonToolbar>
                    </Form>
                )
            }}
        </Formik>
    );
};
