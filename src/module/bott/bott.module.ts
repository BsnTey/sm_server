import { Module } from '@nestjs/common';
import { BottService } from './bott.service';
import { BotTHeadersService } from './headers.service';
import { HttpModule } from '../http/http.module';
import { ProxyModule } from '../proxy/proxy.module';

@Module({
    providers: [BottService, BotTHeadersService],
    exports: [BottService, BotTHeadersService],
    imports: [HttpModule, ProxyModule],
})
export class BottModule {}
