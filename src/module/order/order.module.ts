import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { AccountModule } from '../account/account.module';
import { ProxyModule } from '../proxy/proxy.module';
import { OrderRepository } from './order.repository';

@Module({
    controllers: [OrderController],
    providers: [OrderService, OrderRepository],
    imports: [AccountModule],
    exports: [OrderService],
})
export class OrderModule {}
