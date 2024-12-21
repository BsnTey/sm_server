import { Module } from '@nestjs/common';
import { WebAppController } from './webapp.controller';
import { TelegramModule } from '../telegram/telegram.module';
import { TelegramService } from '../telegram/telegram.service';
import { ConfigService } from '@nestjs/config';
import { MirrorService } from '../mirror/mirror.service';
import { MirrorModule } from '../mirror/mirror.module';
import { AccountModule } from '../account/account.module';

@Module({
    controllers: [WebAppController],
    imports: [TelegramModule, MirrorModule, AccountModule],
    providers: [TelegramService, ConfigService, MirrorService],
    exports: [],
})
export class WebappModule {}
