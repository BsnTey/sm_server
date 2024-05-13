import { Module } from '@nestjs/common';
import { BaseUpdate } from './updates/base-command/base-command.update';
import { StartUpdate } from './updates/start/start.update';
import { UserService } from '../user/user.service';
import { UserRepository } from '../user/user.repository';
import { ChangeNumberInputNumber, ChangeNumberUpdate } from './updates/change-number/change-number.update';
import { AccountService } from '../account/account.service';
import { AccountRepository } from '../account/account.repository';
import { ProxyService } from '../proxy/proxy.service';
import { TelegramService } from './telegram.service';

@Module({
    providers: [
        TelegramService,
        BaseUpdate,
        StartUpdate,
        UserService,
        UserRepository,
        ChangeNumberUpdate,
        AccountService,
        AccountRepository,
        ProxyService,
        ChangeNumberInputNumber,
    ],
})
export class TelegramModule {}
