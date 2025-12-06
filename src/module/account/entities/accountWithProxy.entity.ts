import { CitySM, Proxy } from '@prisma/client';
import { AccountEntity } from './account.entity';

export class AccountWithProxyEntity extends AccountEntity {
    proxy: Proxy;
    citySM: CitySM;

    constructor(account: Partial<AccountWithProxyEntity>) {
        super(account);
        Object.assign(this, account);
        return this;
    }
}
