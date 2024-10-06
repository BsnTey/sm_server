import { Controller, Get, HttpCode } from '@nestjs/common';
import { BottService } from './bott.service';
import { HasZenno } from '@common/decorators/zenno.decorator';

@Controller('payment')
export class BottController {
    constructor(private bottService: BottService) {}

    @HasZenno()
    @Get()
    @HttpCode(200)
    async getAllPaymentOrders(): Promise<any> {
        return await this.bottService.getAllPaymentOrders();
    }
}
