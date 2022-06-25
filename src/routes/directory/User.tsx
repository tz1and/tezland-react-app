import React from 'react';
import { useParams } from 'react-router-dom';
import { Tab, Tabs } from 'react-bootstrap';
import assert from 'assert';
import { Collection } from '../../components/Collection';
import { Creations } from '../../components/Creations';
import { Places } from '../../components/Places';
import { truncateAddress } from '../../utils/Utils';

type UserProps = {}

const User: React.FC<UserProps> = (props) => {
    const params = useParams();

    assert(params.address);
    const accountAddress = params.address;
    const activeKey = window.location.hash.replace('#', '') || undefined;

    return (
        <main>
            <div className="position-relative container text-start mt-4">
                <h1>{truncateAddress(accountAddress)}</h1>

                <Tabs defaultActiveKey="collection" activeKey={activeKey!}
                    mountOnEnter={true} unmountOnExit={true}
                    onSelect={(eventKey) => window.location.hash = eventKey || ""}>
                    <Tab eventKey="collection" title="Collection">
                        <Collection address={accountAddress} />
                    </Tab>
                    <Tab eventKey="creations" title="Creations">
                        <Creations address={accountAddress} />
                    </Tab>
                    <Tab eventKey="places" title="Places">
                        <Places address={accountAddress} />
                    </Tab>
                </Tabs>
            </div>
        </main>
    );
}

export default User;