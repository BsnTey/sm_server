import { CitySM } from '@prisma/client';
import { IFindCitiesAccount } from '../interfaces/account.interface';

export class CitySMEntity implements CitySM {
    cityId: string;
    name: string;
    fullName: string;

    createdAt: Date;
    updatedAt: Date;

    constructor(account: Partial<IFindCitiesAccount>) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        this.cityId = account.id;
        Object.assign(this, account);
        return this;
    }
}
