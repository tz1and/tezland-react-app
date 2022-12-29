import React from 'react';
import {
    Formik,
    Form,
    Field,
    FormikErrors,
    ErrorMessage
} from 'formik';
import BigNumber from 'bignumber.js';
import assert from 'assert';
import ItemNode from '../world/nodes/ItemNode';
import ItemTracker from '../controllers/ItemTracker';
import { TeleporterType } from '../utils/ItemData';
import { Vector3 } from '@babylonjs/core';
import { useTezosWalletContext } from '../components/TezosWalletContext';


interface PlaceFormValues {
    tokenKey: string;
    itemAmount: number;
    itemPrice: number;
    transferToPlace: boolean;
    primarySwap: boolean;
    disableCollision: boolean;
    teleporterType: "none" | "exterior" | "interior" | "local";
    teleporterTargetPlace: number;
}

type PlaceFormProps = {
    closeForm(): void;
    placedItem: ItemNode;
    maxQuantity: number;
}

export const PlaceForm: React.FC<PlaceFormProps> = (props) => {
    const initialValues: PlaceFormValues = {
        tokenKey: props.placedItem.tokenKey.toString(),
        itemAmount: 1,
        itemPrice: 0,
        transferToPlace: false,
        primarySwap: false,
        disableCollision: false,
        teleporterType: "none",
        teleporterTargetPlace: 0
    };

    const errorDisplay = (e: string) => <small className="d-block text-danger">{e}</small>;

    const cancelForm = () => {
        props.placedItem.dispose();
        props.closeForm();
    }

    const is_place_owner = props.placedItem.getPlace().currentOwner === useTezosWalletContext().walletPHK();

    return (
        <div className='p-4 m-4 bg-light bg-gradient border-0 rounded-3 text-dark position-relative'>
            <button type="button" className="p-3 btn-close position-absolute top-0 end-0" aria-label="Close" onClick={cancelForm} />
            <h2>place Item</h2>
            <Formik
                initialValues={initialValues}
                validate = {(values) => {
                    const errors: FormikErrors<PlaceFormValues> = {};
                  
                    if (values.itemPrice !== 0 && values.itemPrice < 0.000001) {
                        errors.itemPrice = 'Price invalid';
                    }

                    if (values.itemAmount < 1 || values.itemAmount > props.maxQuantity) {
                        errors.itemAmount = 'Amount invalid';
                    }

                    if (values.teleporterTargetPlace < 0 || values.teleporterTargetPlace > 2147483647) {
                        errors.itemAmount = 'Invalid target place';
                    }
                  
                    return errors;
                }}
                onSubmit={(values, actions) => {
                    assert(props.placedItem);
                    // set amount and price on Node (item) metadata.
                    if (props.placedItem) {
                        props.placedItem.itemAmount = new BigNumber(values.itemAmount);
                        props.placedItem.xtzPerItem = values.itemPrice;
                        props.placedItem.disableCollisions = values.disableCollision;
                        props.placedItem.placeOwned = values.transferToPlace;
                        props.placedItem.primarySwap = values.primarySwap;

                        if (values.teleporterType !== "none") {
                            switch (values.teleporterType) {
                                case "exterior":
                                    props.placedItem.teleporterData = {
                                        type: TeleporterType.Exterior,
                                        placeId: values.teleporterTargetPlace };
                                    break;

                                case "interior":
                                    props.placedItem.teleporterData = {
                                        type: TeleporterType.Interior,
                                        placeId: values.teleporterTargetPlace };
                                    break;

                                case "local":
                                    props.placedItem.teleporterData = {
                                        type: TeleporterType.Local,
                                        position: new Vector3() };
                                    break;

                                default: throw new Error("Unhandled teleporter type");
                            }
                        }

                        ItemTracker.trackTempItem(props.placedItem.getPlace().placeKey.id, props.placedItem.tokenKey, values.itemAmount);
                    }

                    actions.setSubmitting(false);

                    props.closeForm();
                }}
            >
                {({
                    setFieldValue,
                    isSubmitting,
                    isValid,
                    values
                }) => {
                    return (
                        <Form>
                            <div className="mb-3">
                                <label htmlFor="tokenKey" className="form-label">Token Key</label>
                                <Field id="tokenKey" name="tokenKey" type="string" className="form-control" aria-describedby="tokenKeyHelp" disabled={true} />
                                <div id="tokenKeyHelp" className="form-text">The key of the Item you want to place. Must be owned.</div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="itemAmount" className="form-label">Amount</label>
                                <Field id="itemAmount" name="itemAmount" type="number" min={1} max={props.maxQuantity} className="form-control" aria-describedby="amountHelp" disabled={isSubmitting} autoFocus={true} />
                                <div id="amountHelp" className="form-text">The number of Items to place. Can't be more than the amount you own.<br/>(Current balance: {props.maxQuantity})</div>
                                <ErrorMessage name="itemAmount" children={errorDisplay}/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="itemPrice" className="form-label">Price</label>
                                <div className="input-group mb-3">
                                    <span className="input-group-text">{'\uA729'}</span>
                                    <Field id="itemPrice" name="itemPrice" type="number" min={0} step="any" className="form-control" aria-describedby="priceHelp" disabled={isSubmitting} />
                                </div>
                                <div id="priceHelp" className="form-text">The price for each Item. Set 0&#42793; if you don't want to swap.<br/>
                                For <i>freebies</i>, <button type="button" className="btn btn-sm btn-link p-0 m-0 align-baseline" onClick={() => setFieldValue('itemPrice', 0.000001)}>set 0.000001&#42793;</button>.</div>
                                <ErrorMessage name="itemPrice" children={errorDisplay}/>
                            </div>
                            <div className="mb-3">
                                <Field id="transferToPlace" name="transferToPlace" type="checkbox" className="form-check-input me-2" aria-describedby="transferToPlaceHelp" disabled={isSubmitting}/>
                                <label htmlFor="transferToPlace" className="form-label mb-0">Transfer to Place
                                    <div id="transferToPlaceHelp" style={{padding: "0.25rem", margin: "-0.25rem"}} className={`form-text ${values.transferToPlace && !is_place_owner && "text-danger bg-danger-light rounded"}`}>
                                        If you are not the place owner, transferring an item to the place will be a gift to the owner.
                                    </div>
                                </label>
                            </div>
                            <div className="mb-3">
                                <input className="form-check-input" type="checkbox" value="" id="extra-options-check" data-bs-toggle="collapse" data-bs-target="#collapseExample" aria-expanded="false" aria-controls="collapseExample" />
                                <label className="form-check-label" htmlFor="extra-options-check">&nbsp;Show extra options</label>
                            </div>
                            <div className="collapse" id="collapseExample">
                                <div className="card card-body">
                                    <div className="mb-3">
                                        <Field id="primarySwap" name="primarySwap" type="checkbox" className="form-check-input me-2" aria-describedby="primarySwapHelp" disabled={isSubmitting}/>
                                        <label htmlFor="primarySwap" className="form-label mb-0">Primary Swap
                                            <div id="primarySwapHelp" className="form-text mb-0">
                                                If enabled, entire value will be split according to the royalty splits.
                                            </div>
                                        </label>
                                    </div>
                                    <div className="mb-3">
                                        <Field id="disableCollision" name="disableCollision" type="checkbox" className="form-check-input me-2" aria-describedby="disableCollisionHelp" disabled={isSubmitting}/>
                                        <label htmlFor="disableCollision" className="form-label mb-0">Disable collision <div id="disableCollisionHelp" className="form-text mb-0">Disable collision on the placed item.</div></label>
                                    </div>
                                    <div>
                                        <label htmlFor="teleporterType" className="form-label">Teleporter</label>
                                        <Field id="teleporterType" name="teleporterType" as="select" value={values.teleporterType} className="form-select" aria-describedby="teleporterTypeHelp" disabled={isSubmitting} >
                                            <option key={"none"} value={"none"}>None</option>
                                            <option key={"exterior"} value={"exterior"}>Place</option>
                                            <option key={"interior"} value={"interior"}>Interior</option>
                                            {/*<option key={"local"} value={"local"}>Local</option>*/}
                                        </Field>
                                        <div id="teleporterTypeHelp" className="form-text">Turns this item into a teleporter.</div>
                                    </div>
                                    {/* Show place id input for the right teleporter types. */}
                                    {(values.teleporterType === "exterior" || values.teleporterType === "interior") && <div className="mt-3">
                                        <label htmlFor="teleporterTargetPlace" className="form-label">Target Place/Interior</label>
                                        <Field id="teleporterTargetPlace" name="teleporterTargetPlace" type="number" min={0} max={2147483647} className="form-control" aria-describedby="teleporterTargetPlaceHelp" disabled={isSubmitting} autoFocus={true} />
                                        <div id="teleporterTargetPlaceHelp" className="form-text">The Place or Interior this teleporter should take you to.</div>
                                        <ErrorMessage name="teleporterTargetPlace" children={errorDisplay}/>
                                    </div>}
                                </div>
                            </div>
                            <div className="form-text mb-3">There is a 3.5% platform fee on successful swaps.</div>
                            <button type="submit" className="btn btn-primary mb-3" disabled={isSubmitting || !isValid}>place Item</button><br/>
                            <div className='bg-info bg-info p-3 text-dark rounded small mb-2'>Placed Items are transferred to the World contract, but are<br/>retrievable only by you (the owner) or a potential new owner.</div>
                        </Form>
                    )
                }}
            </Formik>
        </div>
    );
};
