import { Module } from '@nestjs/common';
import { WebAppController } from './webapp.controller';
import { TelegramModule } from '../telegram/telegram.module';
import { ConfigService } from '@nestjs/config';
import { MirrorModule } from '../mirror/mirror.module';

@Module({
    imports: [TelegramModule, MirrorModule],
    controllers: [WebAppController],
    providers: [ConfigService],
    exports: [],
})
export class WebappModule {}
