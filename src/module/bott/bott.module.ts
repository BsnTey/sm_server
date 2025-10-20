import { Module } from '@nestjs/common';
import { BottService } from './bott.service';
import { BotTHeadersService } from './headers.service';
import { HttpModule } from '../http/http.module';
import { ProxyModule } from '../proxy/proxy.module';
import { BottWebhookController } from './bott-webhook.controller';
import { BottWebhookService } from './bott-webhook.service';
import { AccountModule } from '../account/account.module';
import { BottPurchaseRepository } from './bott-purchase.repository';
import { BottPurchaseService } from './bott-purchase.service';

@Module({
    imports: [AccountModule, HttpModule, ProxyModule],
    controllers: [BottWebhookController],
    providers: [BottService, BotTHeadersService, BottWebhookService, BottPurchaseRepository, BottPurchaseService],
    exports: [BottService, BotTHeadersService, BottPurchaseService],
})
export class BottModule {}
