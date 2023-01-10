import React, { useEffect, useState } from 'react';
import ModelPreview from '../../forms/ModelPreview';
import { grapphQLUser } from '../../graphql/user';
import { DirectoryUtils } from '../../utils/DirectoryUtils';
import { MetadataUtils, RoyaltiesAndSupply } from '../../utils/MetadataUtils';
import TokenKey from '../../utils/TokenKey';
import { ItemTokenMetadata } from '../../world/Metadata';


type ItemDisplayProps = {
    tokenKey: TokenKey;
    metadata: ItemTokenMetadata;
    displayModel?: boolean;
    targetBlank?: boolean;
}

export const ItemDisplay: React.FC<ItemDisplayProps> = (props) => {
    const [royaltiesAndSupply, setRoyaltiesAndSupply] = useState<RoyaltiesAndSupply>();
    
    useEffect(() => {
        // Fetch royalties
        grapphQLUser.getItemSupplyAndRoyalties({id: props.tokenKey.id.toNumber(), fa2: props.tokenKey.fa2}).then(res => {
            const token = res.itemToken[0];
            setRoyaltiesAndSupply({
                royalties: token.royalties,
                supply: token.supply});
        });

        // Fetch other listings
    }, [props.tokenKey]);

    let royaltiesElement = undefined;
    if (royaltiesAndSupply !== undefined) {
        royaltiesElement = <p>Supply: {royaltiesAndSupply.supply}<br />Royalties: {royaltiesAndSupply.royalties === 0 ? 0 : (royaltiesAndSupply.royalties / 10).toFixed(2)}{"\u0025"}</p>
    }

    const extraProps = props.targetBlank ? {
        target: "_blank", rel: "noopener noreferrer"
    } : {}

    return (
        props.metadata ? <div>
            {props.targetBlank && <div>{DirectoryUtils.itemLinkElement(props.tokenKey, true)}</div>}
            by {DirectoryUtils.userLinkElement(props.metadata.minter, props.targetBlank)}<br/>
            Collection: {DirectoryUtils.collectionLinkElement(props.tokenKey.fa2, props.targetBlank)}#{props.tokenKey.id.toNumber()}<br/>

            {props.displayModel ?
                <ModelPreview tokenKey={props.tokenKey} width={640} height={480} modelLoaded={() => {}} /> :
                <img src={MetadataUtils.getThumbnailUrl(props.metadata)} width={350} height={350} alt="..." />}

            <h5 className="mt-3">Description:</h5>
            <p style={{whiteSpace: "pre-wrap"}}>{MetadataUtils.getDescription(props.metadata)}</p>
            {royaltiesElement}
        </div> : <></>
    );
}
