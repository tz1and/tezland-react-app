import React, { useEffect, useState } from 'react';
import { useTezosWalletContext } from '../components/TezosWalletContext';
import BasePlaceNode, { PlacePermissions } from '../world/nodes/BasePlaceNode';
import { grapphQLUser } from '../graphql/user';
import { GetGivenPermissionsQuery } from '../graphql/generated/user';
import { DirectoryUtils } from '../utils/DirectoryUtils';
import Contracts from '../tz/Contracts';
import { Table } from 'react-bootstrap';
import { truncateAddress } from '../utils/TezosUtils';


type PlaceRemovePermissionsFormProps = {
    place: BasePlaceNode;
}

export const PlaceRemovePermissionsForm: React.FC<PlaceRemovePermissionsFormProps> = (props) => {
    const context = useTezosWalletContext();
    const [givenPermissionsForPlace, setGivenPermissionsForPlace] = useState<GetGivenPermissionsQuery>();

    useEffect(() => {
        grapphQLUser.getGivenPermissions({address: context.walletPHK(), fa2: props.place.placeKey.fa2, id: props.place.placeKey.id }).then(res => {
            setGivenPermissionsForPlace(res);
        })
    }, [props.place, context])

    const deletePermissions = async (permittee: string) => {
        Contracts.removePlacePermissions(context, props.place.currentOwner, props.place.placeKey, permittee, (completed: boolean) => {
            // update a counter or so, to refresh permissions.
            //setState({error: "Transaction failed", successState: -1});
        }).catch((reason: any) => {
            // Display some kind of error message?
            //setState({error: reason.message, successState: -1});
        });
    }

    const permissionRows: JSX.Element[] = []
    if (givenPermissionsForPlace && givenPermissionsForPlace.holder.length > 0)
        givenPermissionsForPlace.holder[0].givenPermissions.forEach((permission) => {
            permissionRows.push(
                <tr key={permission.permitteeId}>
                    <td><a href={DirectoryUtils.userLink(permission.permitteeId)} target="_blank" rel="noreferrer">{truncateAddress(permission.permitteeId)}</a></td>
                    <td>{new PlacePermissions(permission.premissions).toString()}</td>
                    <td><button className={`btn btn-primary`} onClick={() => deletePermissions(permission.permitteeId)}>Remove</button></td>
                </tr>
            );
        });

    return (
        <Table>
            <thead>
                <tr>
                    <th scope="col">Permittee</th>
                    <th scope="col">Permissions</th>
                    <th scope="col"></th>
                </tr>
            </thead>
            <tbody>
                {permissionRows}
            </tbody>
        </Table>
    );
}
