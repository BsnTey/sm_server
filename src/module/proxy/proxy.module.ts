import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { ProxyRepository } from './proxy.repository';
import { ProxyController } from './proxy.controller';

@Module({
    controllers: [ProxyController],
    providers: [ProxyService, ProxyRepository],
    exports: [ProxyService],
})
export class ProxyModule {}
