import { CitySM } from '@prisma/client';

export class CitySMEntity implements CitySM {
    cityId: string;
    name: string;
    fullName: string;
    xLocation: string;

    createdAt: Date;
    updatedAt: Date;

    constructor(city: Partial<any>) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        this.cityId = city.id;
        Object.assign(this, city);
        return this;
    }
}
