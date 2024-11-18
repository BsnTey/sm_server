import { Module } from '@nestjs/common';
import { MirrorController } from './mirror.controller';
import { MirrorService } from './mirror.service';
import { AccountModule } from '../account/account.module';
import { ProxyModule } from '../proxy/proxy.module';

@Module({
    controllers: [MirrorController],
    providers: [MirrorService],
    imports: [AccountModule, ProxyModule],
})
export class MirrorModule {}
