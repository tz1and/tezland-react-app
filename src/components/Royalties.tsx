import { Field, FieldArray, FieldInputProps } from 'formik';
import React from 'react';
import { Container, Col, Row } from 'react-bootstrap';

type RoyaltiesProps = {
    form: any; // TODO: what's the type???
    field: FieldInputProps<{ address: string, royalties: number }[]>;
};

export const Royalties: React.FC<RoyaltiesProps> = (props) => {
    return (
        <FieldArray
            name="itemRoyalties"
            render={arrayHelpers => (
                <div>
                    <Container className='mx-0 px-0'>
                        {props.field.value && props.field.value.length > 0 && (
                            props.field.value.map((address, index) => (
                                <Row className='gx-2 mb-2' key={index}>
                                    <Col sm='12' md='7'>
                                        <Field name={`itemRoyalties.${index}[0]`} type="text" className="form-control"/>
                                    </Col>
                                    <Col sm='12' md='4'>
                                        <div className="input-group">
                                            <span className="input-group-text">%</span>
                                            <Field name={`itemRoyalties.${index}[1]`} type="number" /*min="0.1" max="25"*/ className="form-control" aria-describedby="royaltiesHelp" disabled={props.form.isSubmitting} />
                                        </div>
                                    </Col>
                                    <Col sm='12' md='1'>
                                        <button type="button" className="btn btn-outline-primary" onClick={() => arrayHelpers.remove(index)}>-</button>
                                    </Col>
                                </Row>
                            ))
                        )}
                    </Container>
                    <button type="button" className="btn btn-outline-primary" onClick={() => arrayHelpers.push(['', 10])} disabled={props.form.isSubmitting || (props.field.value && props.field.value.length >= 3)}>
                        Add Royalties
                    </button>
                </div>
            )}
        />
    );
}
