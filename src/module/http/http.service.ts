import axios from 'axios';
import { Injectable } from '@nestjs/common';
import { HttpOptions, IHttpInterface } from './interfaces/http.interface';

@Injectable()
export class HttpService implements IHttpInterface {
    constructor() {}

    async get(url: string, { headers, httpsAgent }: HttpOptions): Promise<any> {
        return await axios.get(url, {
            headers,
            httpsAgent,
        });
    }

    async post(url: string, payload: any, { headers, httpsAgent }: HttpOptions): Promise<any> {
        return await axios.post(url, payload, {
            headers,
            httpsAgent,
        });
    }

    async delete(url: string, { headers, httpsAgent }: HttpOptions): Promise<any> {
        return await axios.delete(url, {
            headers,
            httpsAgent,
        });
    }
}
