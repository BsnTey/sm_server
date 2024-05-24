import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { AccountService } from '../account/account.service';
import { AccountRepository } from '../account/account.repository';
import { ProxyService } from '../proxy/proxy.service';
import { HttpService } from '../http/http.service';
import { ProxyRepository } from '../proxy/proxy.repository';

@Module({
    controllers: [OrderController],
    providers: [OrderService, AccountService, AccountRepository, ProxyService, HttpService, ProxyRepository],
})
export class OrderModule {}
