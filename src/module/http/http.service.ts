import axios, { AxiosResponse } from 'axios';
import { Injectable } from '@nestjs/common';
import { IHttpInterface } from './interfaces/http.interface';

@Injectable()
export class HttpService implements IHttpInterface {
    constructor() {}

    async get<T = any>(url: string, options: any = {}): Promise<AxiosResponse<T>> {
        return axios.get<T>(url, options);
    }

    async post<T = any>(url: string, payload: any, options: any = {}): Promise<AxiosResponse<T>> {
        return await axios.post<T>(url, payload, options);
    }

    async delete<T = any>(url: string, options: any = {}): Promise<AxiosResponse<T>> {
        return await axios.delete<T>(url, options);
    }
}
