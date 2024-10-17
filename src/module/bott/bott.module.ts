import { Module } from '@nestjs/common';
import { BottService } from './bott.service';
import { HttpService } from '../http/http.service';
import { BotTHeadersService } from './entities/headers-bot-t.entity';

@Module({
    providers: [BottService, HttpService, BotTHeadersService],
})
export class BottModule {}
