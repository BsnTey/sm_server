import { Body, Controller, Get, HttpCode, Param, Patch } from '@nestjs/common';
import { HasZenno } from '@common/decorators/zenno.decorator';
import { AccountIdParamsDto } from '../account/dto/uuid-account.dto';
import { PaymentService } from './payment.service';
import { StatusRequestDto } from './dto/updateStatus.dto';

@Controller('payment')
export class PaymentController {
    constructor(private paymentService: PaymentService) {}

    @HasZenno()
    @Get()
    @HttpCode(200)
    async getAllPaymentOrders() {
        return await this.paymentService.getAllPaymentOrders();
    }

    @HasZenno()
    @Patch(':accountId')
    @HttpCode(200)
    async updatePaymentOrder(@Body() dto: StatusRequestDto, @Param() params: AccountIdParamsDto) {
        await this.paymentService.updatePaymentOrderStatus(params.accountId, dto.status);
        return await this.paymentService.getAllPaymentOrders();
    }
}
