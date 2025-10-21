import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { OrderApiWebhook } from './interfaces/order-webhook.interface';
import { BottWebhookService } from './bott-webhook.service';

@Controller('bott')
export class BottWebhookController {
    constructor(private bottWebhookService: BottWebhookService) {}

    @Post('webhook/order')
    @HttpCode(200)
    async orderWebhook(@Body() dto: OrderApiWebhook): Promise<any> {
        console.log(dto);
        return this.bottWebhookService.create(dto);
    }
}
