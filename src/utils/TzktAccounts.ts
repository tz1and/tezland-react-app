import { Logging } from "./Logging";
import { truncateAddress } from "./TezosUtils";


export class TzktAccount {
    address: string;
    alias: string | undefined;

    constructor(address: string, alias?: string) {
        this.address = address;
        this.alias = alias;
    }

    public getNameDisplay(): string {
        if (this.alias) return this.alias;
        else return truncateAddress(this.address);
    }

    public getName(): string {
        if (this.alias) return this.alias;
        else return this.address;
    }
}

class TzktAccounts {
    private accountCache: Map<string, Promise<TzktAccount>>;

    constructor() {
        this.accountCache = new Map<string, Promise<any>>();
    }

    public getAccount(account: string): Promise<TzktAccount> {
        const cached_account = this.accountCache.get(account);
        if (cached_account) {
            Logging.InfoDev("Used cached TzktAccount for", account);
            return cached_account;
        }

        const promised_account = TzktAccounts.fetchAccount(account);
        this.accountCache.set(account, promised_account);
        return promised_account;
    }

    private static async fetchAccount (account: string) {
        const res = await fetch(`https://api.tzkt.io/v1/accounts/${account}`);
        const parsed = await res.json();

        return new TzktAccount(parsed.address, parsed.alias);
    }
}

const tzktAccounts = new TzktAccounts();
export default tzktAccounts;