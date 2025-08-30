import { Body, Controller, Get, HttpCode, Param, Patch, Query } from '@nestjs/common';
import { HasZenno } from '@common/decorators/zenno.decorator';
import { AccountIdParamsDto } from '../account/dto/uuid-account.dto';
import { PaymentService } from './payment.service';
import { StatusRequestDto } from './dto/updateStatus.dto';
import { GetPaymentOrdersQueryDto } from './dto/queryFilter.dto';
import { PaymentStatsQueryDto } from './dto/stats.query.dto';

@Controller('payment')
export class PaymentController {
    constructor(private paymentService: PaymentService) {}

    @HasZenno()
    @Get()
    @HttpCode(200)
    async getPaymentOrders(@Query() query: GetPaymentOrdersQueryDto) {
        return this.paymentService.getPaymentOrders({ page: query.page, limit: query.limit }, { status: query.status });
    }

    @HasZenno()
    @Patch(':accountId')
    @HttpCode(200)
    async updatePaymentOrder(@Body() dto: StatusRequestDto, @Param() params: AccountIdParamsDto) {
        await this.paymentService.updatePaymentOrderStatus(params.accountId, dto.status);
        return await this.paymentService.getPaymentOrders({ page: undefined, limit: undefined }, { status: undefined });
    }

    @HasZenno()
    @Get('stats')
    @HttpCode(200)
    async getStats(@Query() q: PaymentStatsQueryDto) {
        return this.paymentService.getPaymentStats({
            from: q.from,
            to: q.to,
            status: q.status,
        });
    }
}
