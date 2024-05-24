import { Controller, Get, Param, Render } from '@nestjs/common';
import { OrderParamsDto } from './dto/get-order-page.dto';
import { OrderService } from './order.service';

@Controller('order')
export class OrderController {
    constructor(private orderService: OrderService) {}

    @Get(':accountId/:orderNumber')
    @Render('order')
    async getOrder(@Param() params: OrderParamsDto): Promise<any> {
        const resp = await this.orderService.getOrder(params.accountId, params.orderNumber);
        return { order: resp.data.order };
    }
}
