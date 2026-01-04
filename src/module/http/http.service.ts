import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { createTLSClient, TLSClientConfiguration } from '@dryft/tlsclient';
import * as path from 'path';

@Injectable()
export class HttpService {
    private readonly logger = new Logger(HttpService.name);
    private readonly client: AxiosInstance;
    private readonly timeout = 30000;

    constructor(private readonly configService: ConfigService) {
        let libPath = this.configService.getOrThrow<string>('TLS_LIB_PATH');

        if (libPath && libPath.startsWith('./')) {
            libPath = path.join(process.cwd(), libPath);
        }

        this.client = createTLSClient({
            timeout: this.timeout,
            tlsLibPath: libPath,

            insecureSkipVerify: true,
            withRandomTLSExtensionOrder: true,
        });
    }

    async get<T = any>(url: string, options: TLSClientConfiguration = {}): Promise<AxiosResponse<T>> {
        try {
            return this.client.get<T>(url, options as AxiosRequestConfig);
        } catch (error: any) {
            this.handleError('GET', url, error);
            throw error;
        }
    }

    async post<T = any>(url: string, payload: any, options: TLSClientConfiguration = {}): Promise<AxiosResponse<T>> {
        try {
            return this.client.post<T>(url, payload, options as AxiosRequestConfig);
        } catch (error: any) {
            this.handleError('POST', url, error);
            throw error;
        }
    }

    async put<T = any>(url: string, payload: any, options: TLSClientConfiguration = {}): Promise<AxiosResponse<T>> {
        try {
            return this.client.put<T>(url, payload, options as AxiosRequestConfig);
        } catch (error: any) {
            this.handleError('PUT', url, error);
            throw error;
        }
    }

    async delete<T = any>(url: string, options: TLSClientConfiguration = {}): Promise<AxiosResponse<T>> {
        try {
            return this.client.delete<T>(url, options as AxiosRequestConfig);
        } catch (error: any) {
            this.handleError('DELETE', url, error);
            throw error;
        }
    }

    async patch<T = any>(url: string, payload: any, options: TLSClientConfiguration = {}): Promise<AxiosResponse<T>> {
        try {
            return this.client.patch<T>(url, payload, options as AxiosRequestConfig);
        } catch (error: any) {
            this.handleError('PATCH', url, error);
            throw error;
        }
    }

    private handleError(method: string, url: string, error: any) {
        const status = error.response?.status || 'No Status';
        const isProxy = error.config?.proxy ? ' (via proxy)' : '';

        if (status === 404 || status === 401 || status === 403) {
            this.logger.warn(`HTTP ${method} ${status}${isProxy} on ${url}: ${error.message}`);
        } else {
            this.logger.error(`HTTP ${method} error${isProxy} on ${url}: ${error.message}`);
        }
    }
}
