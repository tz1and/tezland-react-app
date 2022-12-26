import React from 'react';
import { useParams } from 'react-router-dom';
import { Tab, Tabs } from 'react-bootstrap';
import assert from 'assert';
import { Owned } from '../../components/Owned';
import { Created } from '../../components/Created';
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

                <Tabs defaultActiveKey="owned" activeKey={activeKey!}
                    mountOnEnter={true} unmountOnExit={true}
                    onSelect={(eventKey) => window.location.hash = eventKey || ""}>
                    <Tab eventKey="owned" title="Owned">
                        <Owned address={accountAddress} />
                    </Tab>
                    <Tab eventKey="created" title="Created">
                        <Created address={accountAddress} />
                    </Tab>
                    {/*<Tab eventKey="collections" title="Collections">
                        <Created address={accountAddress} />
                    </Tab>*/}
                    <Tab eventKey="places" title="Places">
                        <Places address={accountAddress} />
                    </Tab>
                </Tabs>
            </div>
        </main>
    );
}

export default User;