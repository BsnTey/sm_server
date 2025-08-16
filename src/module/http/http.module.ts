import { Module } from '@nestjs/common';
import { HttpService } from './http.service';
import { TlsProxyService } from './tls-forwarder.service';

@Module({
    providers: [HttpService, TlsProxyService],
    exports: [HttpService, TlsProxyService],
})
export class HttpModule {}
