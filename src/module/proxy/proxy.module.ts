import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { ProxyRepository } from './proxy.repository';

@Module({
    providers: [ProxyService, ProxyRepository],
})
export class ProxyModule {}
