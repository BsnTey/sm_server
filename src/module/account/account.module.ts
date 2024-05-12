import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountRepository } from './account.repository';
import { ProxyService } from '../proxy/proxy.service';

@Module({
    controllers: [AccountController],
    providers: [AccountService, AccountRepository, ProxyService],
})
export class AccountModule {}
