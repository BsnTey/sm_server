import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from './http.service';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config'; // ИЗМЕНЕНИЕ 1: Импортируем ConfigService

interface TlsForwardPayload {
    sessionId: string;
    tlsClientIdentifier: string;
    followRedirects: boolean;
    insecureSkipVerify: boolean;
    timeoutSeconds: number;
    proxyUrl?: string;
    headers: Record<string, string>;
    requestUrl: string;
    requestMethod: 'GET' | 'POST' | 'PUT' | 'DELETE';
    requestBody: string;
}

@Injectable()
export class TlsProxyService {
    private readonly logger = new Logger(TlsProxyService.name);
    private readonly tlsApiUrl: string;
    private readonly tlsApiKey: string;
    private readonly tlsClientIdentifier: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.tlsApiUrl = this.configService.getOrThrow<string>('TLS_FORWARDER_URL');
        this.tlsApiKey = this.configService.getOrThrow<string>('TLS_FORWARDER_API_KEY');
        this.tlsClientIdentifier = this.configService.getOrThrow<string>('TLS_CLIENT_IDENTIFIER');
    }

    async forwardRequest<T = any>(params: {
        requestUrl: string;
        requestMethod: TlsForwardPayload['requestMethod'];
        headers: Record<string, string>;
        headerOrder?: string[];
        requestBody: object;
        proxyUrl?: string;
    }): Promise<T> {
        this.logger.log(`Forwarding request to ${params.requestUrl} via TLS proxy`);

        const payload: TlsForwardPayload = {
            sessionId: `sm_${Date.now()}_${randomUUID()}`,
            tlsClientIdentifier: this.tlsClientIdentifier,
            followRedirects: false,
            insecureSkipVerify: false,
            timeoutSeconds: 60,
            proxyUrl: params.proxyUrl || '',
            headers: params.headers,
            requestUrl: params.requestUrl,
            requestMethod: params.requestMethod,
            requestBody: JSON.stringify(params.requestBody),
        };

        try {
            const response = await this.httpService.post(this.tlsApiUrl, payload, {
                headers: {
                    'x-api-key': this.tlsApiKey,
                },
            });

            if (response.data && response.data.body) {
                if (typeof response.data.body === 'string' && response.data.headers['Content-Type']?.includes('application/json')) {
                    return JSON.parse(response.data.body);
                }
                return response.data.body;
            }

            if (response.data && response.data.status >= 400) {
                this.logger.error('TLS Proxy returned an error status:', response.data.status, response.data.body);
                throw new Error(`TLS Proxy forward error: ${response.data.body}`);
            }

            throw new Error('Invalid response structure from TLS proxy');
        } catch (error: any) {
            this.logger.error(`Error forwarding request to ${params.requestUrl}:`, error.message);
            if (error.response?.data) {
                this.logger.error('TLS Proxy Error Response:', error.response.data);
            }
            throw error;
        }
    }
}
