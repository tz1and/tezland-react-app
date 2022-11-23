import BigNumber from "bignumber.js";


export default class TokenKey {
    readonly id: BigNumber;
    readonly fa2: string;

    constructor(id: BigNumber, fa2: string) {
        this.id = id;
        this.fa2 = fa2;
    }

    public static fromNumber(id: number, fa2: string): TokenKey {
        return new TokenKey(new BigNumber(id), fa2);
    }

    public toString(): string {
        return `${this.fa2}#${this.id.toNumber()}`;
    }
}