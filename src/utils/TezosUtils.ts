import BigNumber from "bignumber.js";


export const tokensAmountToNat = (tokensAmount: BigNumber | number, decimals: number): BigNumber => {
    return new BigNumber(tokensAmount).multipliedBy(10 ** decimals).integerValue();
};

export const numberToTokensAmount = (value: BigNumber | number, decimals: number): BigNumber => {
    return new BigNumber(value).div(10 ** decimals);
};

const tezDecimals = 6;
export const tezToMutez = (tez: BigNumber | number): BigNumber => tokensAmountToNat(tez, tezDecimals);
export const mutezToTez = (mutez: BigNumber | number): BigNumber => numberToTokensAmount(mutez, tezDecimals);

const isTezosAccountAddress = (address: string) => {
    const match = address.match(/^(tz(1|2|3|4)|KT1)/);
    return address.length === 36 && (match !== null && match.length > 0);
}

export const truncateAddress = (address: string) => {
    if (isTezosAccountAddress(address)) {
        return address.substring(0, 8) + '\u2026' + address.substring(address.length - 5, address.length);
    }

    return address;
}

const isTezosOperationHash = (opHash: string) => {
    return opHash.length === 51 && opHash.startsWith('o');
}

export const truncateOperationHash = (opHash: string) => {
    if (isTezosOperationHash(opHash)) {
        return opHash.substring(0, 7) + '\u2026' + opHash.substring(opHash.length - 5, opHash.length);
    }

    return opHash;
}