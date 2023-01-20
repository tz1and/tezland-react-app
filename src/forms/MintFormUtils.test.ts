import Conf from '../Config';
import MintFormUitls from './MintFormUtils';
import fs from 'fs';


function bufferToDataUri(buffer: Buffer): string {
    return "data:image/png;base64," + buffer.toString('base64');
}

const validThumbnailImage = fs.readFileSync('assets/test/img/thumbnail.png');
const validThumbnailImageUri = bufferToDataUri(validThumbnailImage);
const validDisplayImage = fs.readFileSync('assets/test/img/display.png');
const validDisplayImageUri = bufferToDataUri(validDisplayImage);

test('valid form values', async () => {
    const form_values = {
        collection: Conf.item_contract,
        itemTitle: "Test",
        itemDescription: "Test",
        itemTags: "Test",
        itemAmount: 10,
        itemRoyalties: [ [Conf.world_contract, 10.0] ],
        frameRatio: 0.02,
        frameColor: "#222222",
        itemFile: new File([Buffer.from("ffffffff", "hex")], "test.glb", {type: "model/gltf-binary"})
    } as MintFormUitls.MintFormValues;

    expect(() => MintFormUitls.formValuesToItemTokenMetadata(form_values, Conf.world_contract, 10, new Date(),
        validThumbnailImageUri, validDisplayImageUri, undefined)).not.toThrow();

    const res = await MintFormUitls.formValuesToItemTokenMetadata(form_values, Conf.world_contract, 10, new Date(),
        validThumbnailImageUri, validDisplayImageUri, undefined);
    expect(res).toMatch(`${Conf.fees_address}`);
    expect(res).not.toMatch(`imageFrame`);
});

test('royalty free contains no marketplace royalties', async () => {
    const form_values = {
        collection: Conf.item_contract,
        itemTitle: "Test",
        itemDescription: "Test",
        itemTags: "Test",
        itemAmount: 10,
        itemRoyalties: [],
        frameRatio: 0.02,
        frameColor: "#222222",
        itemFile: new File([Buffer.from("ffffffff", "hex")], "test.glb", {type: "model/gltf-binary"})
    } as MintFormUitls.MintFormValues;

    expect(() => MintFormUitls.formValuesToItemTokenMetadata(form_values, Conf.world_contract, 10, new Date(),
        validThumbnailImageUri, validDisplayImageUri, undefined)).not.toThrow();

    const res = await MintFormUitls.formValuesToItemTokenMetadata(form_values, Conf.world_contract, 10, new Date(),
        validThumbnailImageUri, validDisplayImageUri, undefined);
    expect(res).not.toMatch(`${Conf.fees_address}`);
    expect(res).not.toMatch(`imageFrame`);
});