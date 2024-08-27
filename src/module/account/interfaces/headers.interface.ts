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

interface IRequestHeadersCourse {}
