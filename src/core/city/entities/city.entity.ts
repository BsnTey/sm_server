import { CitySM } from '@prisma/client';
import { Type } from 'class-transformer';

export class CityEntity implements CitySM {
    cityId: string;
    name: string;
    fullName: string;
    xLocation: string;

    @Type(() => Date)
    createdAt: Date;

    @Type(() => Date)
    updatedAt: Date;

    constructor(partial: Partial<CityEntity>) {
        Object.assign(this, partial);
    }
}