import { Module } from '@nestjs/common';
import { MirrorController } from './mirror.controller';
import { MirrorService } from './mirror.service';
import { AccountService } from '../account/account.service';
import { AccountRepository } from '../account/account.repository';
import { ProxyService } from '../proxy/proxy.service';
import { HttpService } from '../http/http.service';
import { SportmasterHeadersService } from '../account/entities/headers.entity';
import { ProxyRepository } from '../proxy/proxy.repository';

@Module({
    controllers: [MirrorController],
    providers: [MirrorService, AccountService, AccountRepository, ProxyService, HttpService, SportmasterHeadersService, ProxyRepository],
})
export class MirrorModule {}
