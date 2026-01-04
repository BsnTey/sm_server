import { DeviceInfo } from '@prisma/client';
import { Type } from 'class-transformer';

export class DeviceInfoEntity implements DeviceInfo {
    id: string;
    accountId: string;
    osVersion: string;
    buildVersion: string;
    brand: string;
    model: string;
    screenResolution: string;
    browserVersion: string;
    IP: string;

    @Type(() => Date)
    createdAt: Date;

    @Type(() => Date)
    updatedAt: Date;

    constructor(partial: Partial<DeviceInfoEntity>) {
        Object.assign(this, partial);
    }
}