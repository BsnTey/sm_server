import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountRepository } from './account.repository';
import { SportmasterHeadersService } from './entities/headers.entity';
import { ProxyModule } from '../proxy/proxy.module';
import { HttpModule } from '../http/http.module';

@Module({
    controllers: [AccountController],
    providers: [AccountService, AccountRepository, SportmasterHeadersService],
    exports: [AccountService, AccountRepository, SportmasterHeadersService],
    imports: [ProxyModule, HttpModule],
})
export class AccountModule {}
