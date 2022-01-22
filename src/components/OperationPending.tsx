import React from 'react';

export type OperationPendingData = {
    hash: string,
    done: boolean,
    success?: boolean,
    error?: string
    //closeForm(cancelled: boolean): void;
}

type OperationPendingProps = {
    data: OperationPendingData
}

export const OperationPending: React.FC<OperationPendingProps> = (props: OperationPendingProps) => {
    let color = props.data.done ? props.data.success ? "bg-success" : "bg-danger" : "bg-primary"
    let title = props.data.done ? props.data.success ? "succeeded" : "failed" : "pending"
    let body = props.data.done ? props.data.success ? "Transaction finised successfully." : "Transaction failed: " + props.data.error : "Waiting for transaction to complete."

    return (
        <div className={`toast align-items-center text-white ${color} border-0 show`} role="alert" aria-live="assertive" aria-atomic="true">
            <div className="d-flex">
                <div className="toast-body">
                    <p className='mb-2 fw-bolder'>Operation {title}</p>
                    {body}<br/>Hash: <a className='link-light' href={'https://tzkt.io/' + props.data.hash} target='_blank' rel="noreferrer">{props.data.hash.substring(0, 23)}...</a>
                </div>
                { props.data.done ?
                    <button type="button" className="btn-close btn-close-white me-2 mt-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button> :
                    <div className="spinner-border text-white me-3 m-auto" role="status"></div>
                }
            </div>
        </div>
    )
}