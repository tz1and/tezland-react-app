import Conf from '../Config';
import MintFormUitls from './MintFormUtils';
import { ItemMetadata } from '../ipfs/ipfs';
import fs from 'fs';


function imageBufferToDataUri(buffer: Buffer): string {
    return "data:image/png;base64," + buffer.toString('base64');
}

const validThumbnailImage = fs.readFileSync('assets/test/img/thumbnail.png');
const validThumbnailImageUri = imageBufferToDataUri(validThumbnailImage);
const validDisplayImage = fs.readFileSync('assets/test/img/display.png');
const validDisplayImageUri = imageBufferToDataUri(validDisplayImage);

const newValidFormValues = (): MintFormUitls.MintFormValues => {
    return {
        collection: Conf.item_contract,
        itemTitle: "Test",
        itemDescription: "Test",
        itemTags: "Test",
        itemAmount: 10,
        itemRoyalties: [],
        frameRatio: 0.02,
        frameColor: "#222222",
        itemFile: new File([Buffer.from("ffffffff", "hex")], "test.glb", {type: "model/gltf-binary"})
    }
}

const expectItemParams = (meta: ItemMetadata) => {
    expect(meta.decimals).toBe(0);
    expect(meta.symbol).toBe('ITEM');
    expect(meta.isTransferable).toBe(true);
    expect(meta.isBooleanAmount).toBe(false);
    expect(meta.shouldPreferSymbol).toBe(false);
}

test('valid form values', async () => {
    const form_values = newValidFormValues();
    form_values.itemRoyalties = [ [Conf.world_contract, 10.0] ];

    expect(() => MintFormUitls.formValuesToItemTokenMetadata(form_values, Conf.world_contract, 10, new Date(),
        validThumbnailImageUri, validDisplayImageUri, undefined)).not.toThrow();

    const res = await MintFormUitls.formValuesToItemTokenMetadata(form_values, Conf.world_contract, 10, new Date(),
        validThumbnailImageUri, validDisplayImageUri, undefined);

    expectItemParams(res);
    expect(res.royalties.shares[Conf.world_contract]).toBe(100);
    expect(res.royalties.shares[Conf.fees_address]).toBe(35);
    expect(res.imageFrame).toBeUndefined()
});

test('royalty free contains marketplace royalties', async () => {
    const form_values = newValidFormValues();

    expect(() => MintFormUitls.formValuesToItemTokenMetadata(form_values, Conf.world_contract, 10, new Date(),
        validThumbnailImageUri, validDisplayImageUri, undefined)).not.toThrow();

    const res = await MintFormUitls.formValuesToItemTokenMetadata(form_values, Conf.world_contract, 10, new Date(),
        validThumbnailImageUri, validDisplayImageUri, undefined);

    expectItemParams(res);
    expect(res.royalties.shares[Conf.fees_address]).toBe(35);
    expect(res.imageFrame).toBeUndefined()
});