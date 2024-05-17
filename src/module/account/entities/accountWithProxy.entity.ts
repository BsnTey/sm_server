import { CitySM, Proxy } from '@prisma/client';
import { AccountEntity } from './account.entity';
import { IAccountWithProxy } from '../interfaces/account.interface';

export class AccountWithProxyEntity extends AccountEntity implements IAccountWithProxy {
    proxy: Proxy | null;
    citySM: CitySM;

    constructor(account: Partial<AccountWithProxyEntity>) {
        super(account);
        Object.assign(this, account);
        return this;
    }
}
