import { IDeviceInfo } from '../interfaces/deviceInfo.interface';

export class DeviceInfoEntity {
    id: string;
    accountId: string;
    osVersion: string;
    buildVersion: string;
    brand: string;
    model: string;
    screenResolution: string;
    browserVersion: string;
    IP: string;

    createdAt: Date;
    updatedAt: Date;

    constructor(partial: Partial<DeviceInfoEntity>) {
        Object.assign(this, partial);
    }

    getDalvikUserAgent(): string {
        return `Dalvik/2.1.0 (Linux; U; Android ${this.osVersion}; ${this.model} Build/${this.buildVersion})`;
    }

    getBrowserUserAgent(): string {
        return `Mozilla/5.0 (Linux; Android ${this.osVersion}; ${this.model} Build/${this.buildVersion}; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${this.browserVersion} Mobile Safari/537.36`;
    }

    getDeviceParams(): IDeviceInfo {
        return {
            id: this.id,
            osVersion: this.osVersion,
            deviceModel: `${this.brand} ${this.model}`,
            buildVersion: this.buildVersion,
            screenResolution: this.screenResolution,
            browserVersion: this.browserVersion,
            IP: this.IP,
            uaDalvik: this.getDalvikUserAgent(),
            uaBrowser: this.getBrowserUserAgent(),
        };
    }
}
