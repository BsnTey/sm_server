import { ISportmasterRequestHeaders } from '../../account/interfaces/headers.interface';
import { SocksProxyAgent } from 'socks-proxy-agent';

export interface IHttpInterface {
    post: (url: string, payload: any, httpOptions: HttpOptions) => Promise<any>;
    get: (url: string, httpOptions: HttpOptions) => Promise<any>;
    delete: (url: string, httpOptions: HttpOptions) => Promise<any>;
    // patch: () => any;
}

export interface HttpOptions {
    headers: ISportmasterRequestHeaders;
    httpsAgent: SocksProxyAgent;
}
