import axios, { AxiosResponse } from 'axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { IHttpInterface } from './interfaces/http.interface';

@Injectable()
export class HttpService implements IHttpInterface {
    private timeout = 10000;

    constructor() {}

    async get<T = any>(url: string, options: any = {}): Promise<AxiosResponse<T>> {
        try {
            return await axios.get<T>(url, { timeout: this.timeout, ...options });
        } catch (error: any) {
            console.error(`HTTP GET error on url ${url}:`, error.message);
            throw new InternalServerErrorException(`Ошибка HTTP GET запроса: ${error}`);
        }
    }

    async post<T = any>(url: string, payload: any, options: any = {}): Promise<AxiosResponse<T>> {
        try {
            return await axios.post<T>(url, payload, { timeout: this.timeout, ...options });
        } catch (error: any) {
            console.error(`HTTP POST error on url ${url}:`, error.message);
            throw new InternalServerErrorException(`Ошибка HTTP POST запроса: ${error}`);
        }
    }

    async delete<T = any>(url: string, options: any = {}): Promise<AxiosResponse<T>> {
        try {
            return await axios.delete<T>(url, { timeout: this.timeout, ...options });
        } catch (error: any) {
            console.error(`HTTP DELETE error on url ${url}:`, error.message);
            throw new InternalServerErrorException(`Ошибка HTTP DELETE запроса: ${error}`);
        }
    }
}
