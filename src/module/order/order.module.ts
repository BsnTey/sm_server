import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { AccountModule } from '../account/account.module';
import { ProxyModule } from '../proxy/proxy.module';

@Module({
    controllers: [OrderController],
    providers: [OrderService],
    imports: [AccountModule, ProxyModule],
})
export class OrderModule {}
