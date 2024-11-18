import { Module } from '@nestjs/common';
import { BottService } from './bott.service';
import { BotTHeadersService } from './entities/headers-bot-t.entity';
import { HttpModule } from '../http/http.module';

@Module({
    providers: [BottService, BotTHeadersService],
    exports: [BottService, BotTHeadersService],
    imports: [HttpModule],
})
export class BottModule {}
