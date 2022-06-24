import React from 'react';
import { useParams } from 'react-router-dom';
import Collection from '../components/Collection';
import Creations from '../components/Creations';
import { Places } from '../components/Places';
import { truncateAddress } from '../utils/Utils';
import { Tab, Tabs } from 'react-bootstrap';
import assert from 'assert';

type UserProps = {}

const Event: React.FC<UserProps> = (props) => {
    const params = useParams();

    assert(params.eventName);
    assert(params.eventLabel);
    const eventName = params.eventName;
    const eventLabel = params.eventLabel;

    return (
        <main>
            <div className="position-relative container text-start mt-4">
                <h1>{eventLabel}</h1>
                <h5>All Places participating in this event</h5>

            </div>
        </main>
    );
}

export default Event;