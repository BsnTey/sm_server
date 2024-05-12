export interface IProxyDict {
    [proxyUrl: string]: IProxy;
}

export interface IProxy {
    isBan: boolean;
    timeBlock: Date;
}
