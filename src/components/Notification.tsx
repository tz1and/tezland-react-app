import React from 'react';

export type NotificationData = {
    id: string
    title: string,
    body: string,
    type: 'warning' | 'danger' | 'info' | 'success'
}

type NotificationProps = {
    data: NotificationData
}

export const Notification: React.FC<NotificationProps> = (props: NotificationProps) => {
    let color = "bg-" + props.data.type;
    let textColor = props.data.type === "info" || props.data.type === "warning" ? "text-dark" : "text-white";
    //let textColor = "text-white";

    return (
        <div className={`toast align-items-center border-0 show ${textColor} ${color}`} role="alert" aria-live="assertive" aria-atomic="true">
            <div className="d-flex">
                <div className="toast-body flex-grow-1" style={{whiteSpace: "pre-wrap"}}>
                    <p className='mb-2 fw-bolder'>{props.data.title}</p>
                    <hr className='my-2'/>
                    {props.data.body}
                </div>
                <button type="button" className="btn-close btn-close-white me-2 mt-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    )
}