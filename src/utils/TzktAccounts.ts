import { Logging } from "./Logging";
import { truncateAddress } from "./Utils";


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
    private accountCache: Map<string, TzktAccount>;

    constructor() {
        this.accountCache = new Map<string, TzktAccount>();
    }

    public async getAccount(account: string): Promise<TzktAccount> {
        const cached_account = this.accountCache.get(account);
        if (cached_account) {
            Logging.InfoDev("Used cached TzktAccount for", account);
            return cached_account;
        }

        const res = await fetch(`https://api.tzkt.io/v1/accounts/${account}`);
        const parsed = await res.json();

        const tzktAccount = new TzktAccount(parsed.address, parsed.alias);
        this.accountCache.set(account, tzktAccount);

        return tzktAccount;
    }
}

export default new TzktAccounts();