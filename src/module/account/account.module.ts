import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountRepository } from './account.repository';
import { ProxyService } from '../proxy/proxy.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../http/http.service';
import { ProxyRepository } from '../proxy/proxy.repository';
import { CitySMRepository } from './city-sm.repository';

@Module({
    controllers: [AccountController],
    providers: [ConfigService, AccountService, AccountRepository, ProxyService, HttpService, ProxyRepository, CitySMRepository],
})
export class AccountModule {}
