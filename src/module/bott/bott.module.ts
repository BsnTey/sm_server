import { Module } from '@nestjs/common';
import { BottService } from './bott.service';
import { BottController } from './bott.controller';
import { BottRepository } from './bott.repository';
import { HttpService } from '../http/http.service';
import { BotTHeadersService } from './entities/headers-bot-t.entity';

@Module({
    controllers: [BottController],
    providers: [BottService, BottRepository, HttpService, BotTHeadersService],
})
export class BottModule {}
