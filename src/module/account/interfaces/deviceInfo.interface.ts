export interface IBaseDeviceInfo {
    osVersion: string;
    screenResolution: string;
    browserVersion: string;
    IP: string;
}

export interface ICreateDeviceInfo extends IBaseDeviceInfo {
    accountId: string;
    buildVersion: string;
    brand: string;
    model: string;
}

export type IUpdateDeviceInfo = Omit<ICreateDeviceInfo, 'accountId'>;

export interface IDeviceInfo extends IBaseDeviceInfo {
    id: string;
    deviceModel: string;
    buildNumber: string;
    uaDalvik: string;
    uaBrowser: string;
}
