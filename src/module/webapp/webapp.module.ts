import { Module } from '@nestjs/common';
import { WebAppController } from './webapp.controller';
import { TelegramModule } from '../telegram/telegram.module';
import { AccountModule } from '../account/account.module';
import { TelegramService } from '../telegram/telegram.service';

@Module({
    imports: [TelegramModule, AccountModule],
    providers: [WebAppController, TelegramService],
    exports: [],
})
export class WebappModule {}
