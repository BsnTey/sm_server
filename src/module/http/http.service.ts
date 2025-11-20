import axios, { AxiosResponse } from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import { IHttpInterface } from './interfaces/http.interface';

@Injectable()
export class HttpService implements IHttpInterface {
    private readonly logger = new Logger(HttpService.name);
    private timeout = 5000;

    constructor() {}

    async get<T = any>(url: string, options: any = {}): Promise<AxiosResponse<T>> {
        try {
            return axios.get<T>(url, { timeout: this.timeout, ...options });
        } catch (error: any) {
            this.logger.error(`HTTP GET error on url ${url}:`, error.message);
            throw error;
        }
    }

    async post<T = any>(url: string, payload: any, options: any = {}): Promise<AxiosResponse<T>> {
        try {
            return axios.post<T>(url, payload, { timeout: this.timeout, ...options });
        } catch (error: any) {
            this.logger.error(`HTTP POST error on url ${url}:`, error.message);
            throw error;
        }
    }

    async delete<T = any>(url: string, options: any = {}): Promise<AxiosResponse<T>> {
        try {
            return axios.delete<T>(url, { timeout: this.timeout, ...options });
        } catch (error: any) {
            this.logger.error(`HTTP DELETE error on url ${url}:`, error.message);
            throw error;
        }
    }
}
