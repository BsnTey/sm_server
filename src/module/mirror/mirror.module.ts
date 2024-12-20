import { Module } from '@nestjs/common';
import { MirrorController } from './mirror.controller';
import { AccountModule } from '../account/account.module';
import { ProxyModule } from '../proxy/proxy.module';
import { MirrorLinkService } from './mirror.service';
import { JwtService } from '@nestjs/jwt';

@Module({
    controllers: [MirrorController],
    providers: [MirrorLinkService, JwtService],
    imports: [AccountModule, ProxyModule],
})
export class MirrorModule {}
