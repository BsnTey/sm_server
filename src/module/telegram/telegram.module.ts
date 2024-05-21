import { Module } from '@nestjs/common';
import { BaseUpdate } from './updates/base-command/base-command.update';
import { StartUpdate } from './updates/start/start.update';
import { UserService } from '../user/user.service';
import { UserRepository } from '../user/user.repository';
import { ChangeNumberInputCode, ChangeNumberInputNumber, ChangeNumberUpdate } from './updates/change-number/change-number.update';
import { AccountService } from '../account/account.service';
import { AccountRepository } from '../account/account.repository';
import { ProxyService } from '../proxy/proxy.service';
import { TelegramService } from './telegram.service';
import { HttpService } from '../http/http.service';
import { ProxyRepository } from '../proxy/proxy.repository';
import {
    MakeOrderUpdate,
    OrderChangeRecipient,
    OrderCity,
    OrderFavouriteCity,
    OrderGetOrders,
    OrderInputArticle,
    OrderInputLink,
    OrderInputPromo,
    OrderMenuAccount,
    OrderMenuCart,
} from './updates/make-order/make-order.update';
import { MakeOrderService } from './updates/make-order/make-order.service';
import { CalculateUpdate } from './updates/calculate/calculate.update';

@Module({
    providers: [
        TelegramService,
        MakeOrderService,
        ProxyRepository,
        HttpService,
        BaseUpdate,
        StartUpdate,
        UserService,
        UserRepository,
        AccountService,
        AccountRepository,
        ProxyService,
        ChangeNumberUpdate,
        ChangeNumberInputNumber,
        ChangeNumberInputCode,
        MakeOrderUpdate,
        OrderMenuAccount,
        OrderCity,
        OrderFavouriteCity,
        OrderMenuCart,
        OrderInputLink,
        OrderInputPromo,
        OrderInputArticle,
        OrderChangeRecipient,
        OrderGetOrders,
        CalculateUpdate,
    ],
})
export class TelegramModule {}
