import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { ProxyRepository } from './proxy.repository';
import { ProxyController } from './proxy.controller';
import { DatabaseModule } from '@common/database';

@Module({
    imports: [DatabaseModule],
    controllers: [ProxyController],
    providers: [ProxyService, ProxyRepository],
    exports: [ProxyService],
})
export class ProxyModule {}
