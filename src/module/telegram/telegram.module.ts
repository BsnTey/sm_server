import { Module } from '@nestjs/common';
import { BaseUpdate, HelpUpdate } from './updates/base-command/base-command.update';
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
import { CheckingUpdate } from './updates/checking/checking.update';
import { CheckingService } from './updates/checking/checking.service';
import { EmailUpdate } from './updates/email/email.update';
import { EmailService } from './updates/email/email.service';
import { CookieUpdate } from './updates/cookie/cookie.update';
import { QrCodeUpdate } from './updates/qr-code/qr-code.update';
import { QrCodeService } from './updates/qr-code/qr-code.service';
import { GetInfoOrderUpdate, ProfileUpdate } from './updates/profile/profile.update';
import { AdminUpdate } from './updates/admin/admin.update';
import { SportmasterHeadersService } from '../account/entities/headers.entity';
import { AuthMirrorUpdate } from './updates/auth-mirror/auth-mirror.update';
import { PaymentUpdate } from './updates/payment/payment.update';
import { BotTHeadersService } from '../bott/entities/headers-bot-t.entity';
import { BottService } from '../bott/bott.service';
import { FileService } from '../shared/file.service';
import { PaymentService } from '../payment/payment.service';
import { PaymentRepository } from '../payment/payment.repository';

@Module({
    providers: [
        TelegramService,
        MakeOrderService,
        ProxyRepository,
        HttpService,
        BaseUpdate,
        HelpUpdate,
        AdminUpdate,
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
        CheckingUpdate,
        CheckingService,
        EmailUpdate,
        EmailService,
        CookieUpdate,
        QrCodeUpdate,
        QrCodeService,
        ProfileUpdate,
        GetInfoOrderUpdate,
        SportmasterHeadersService,
        BotTHeadersService,
        AuthMirrorUpdate,
        PaymentUpdate,
        BottService,
        FileService,
        PaymentService,
        PaymentRepository,
        HttpService,
    ],
})
export class TelegramModule {}
