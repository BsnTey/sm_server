import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { ProxyRepository } from './proxy.repository';

@Module({
    providers: [ProxyService, ProxyRepository],
    exports: [ProxyService, ProxyRepository],
})
export class ProxyModule {}
