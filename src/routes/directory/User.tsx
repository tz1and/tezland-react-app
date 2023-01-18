import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Tab, Tabs } from 'react-bootstrap';
import assert from 'assert';
import { Owned } from '../../components/Owned';
import { Created } from '../../components/Created';
import { Places } from '../../components/Places';
import { DirectoryUtils } from '../../utils/DirectoryUtils';
import TzktAccounts, { TzktAccount } from '../../utils/TzktAccounts';


export const useTzktAlias = (address: string) => {
    const [tzktAccount, setTzktAccount] = useState<TzktAccount>(new TzktAccount(address));
    useEffect(() => {
        TzktAccounts.getAccount(address).then(res => {
            setTzktAccount(res);
        })
    }, [address]);

    return tzktAccount
}

type UserProps = {}

const User: React.FC<UserProps> = (props) => {
    const params = useParams();

    assert(params.address);
    const accountAddress = params.address;
    const activeKey = window.location.hash.replace('#', '') || undefined;

    const tzktAccount = useTzktAlias(params.address)

    return (
        <main>
            <div className="position-relative container text-start mt-4">
                <h1>{tzktAccount.getNameDisplay()}</h1>
                <p>tzkt: {DirectoryUtils.tzktAccountLinkElement(params.address)}</p>

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