interface IRequestHeaders {
    'User-Agent': string;
    Locale: string;
    Country: string;
    'Device-Id': string;
    'Account-Id': string;
    'Installation-Id': string;
    'City-Id': string;
    Eutc: string;
    'x-user-id': string;
    Authorization: string;
    Host: string;
    'Accept-Encoding': string;
    'Content-Type': string;
    Timestamp: string;
    'Aplaut-Id': string;
    'Aplaut-Build': string;
}

export type ISportmasterRequestHeaders = Partial<IRequestHeaders>;

export interface IRequestHeadersUserGate {
    'User-Agent': string;
    Host: string;
    'Upgrade-Insecure-Requests': number;
    Accept: string;
    'Ug-Token': string;
    'Accept-Encoding': string;
    'Accept-Language': string;
    'X-Requested-With': string;
    Referer: string;
}

export interface IRequestHeadersCourse {
    'User-Agent': string;
    Host: string;
    Accept: string;
    Accesstoken: string;
    'Sec-Fetch-Site': string;
    'Sec-Fetch-Mode': string;
    'Sec-Fetch-Dest': string;
    'X-Requested-With': string;
    'Accept-Encoding': string;
    'Accept-Language': string;
    Referer: string;
}
