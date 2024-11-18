import { Module } from '@nestjs/common';
import { BaseUpdate, HelpUpdate } from './updates/base-command/base-command.update';
import { StartUpdate } from './updates/start/start.update';
import { ChangeNumberInputCode, ChangeNumberInputNumber, ChangeNumberUpdate } from './updates/change-number/change-number.update';
import { TelegramService } from './telegram.service';
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
import { GetInfoOrderUpdate, ProfileUpdate, PromocodeBotUpdate } from './updates/profile/profile.update';
import { AdminUpdate } from './updates/admin/admin.update';
import { AuthMirrorUpdate } from './updates/auth-mirror/auth-mirror.update';
import { PaymentUpdate } from './updates/payment/payment.update';
import { AccountModule } from '../account/account.module';
import { ProxyModule } from '../proxy/proxy.module';
import { SharedModule } from '../shared/shared.module';
import { HttpModule } from '../http/http.module';
import { UserModule } from '../user/user.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
    imports: [AccountModule, ProxyModule, SharedModule, HttpModule, UserModule, PaymentModule],
    providers: [
        TelegramService,
        MakeOrderService,
        BaseUpdate,
        HelpUpdate,
        AdminUpdate,
        StartUpdate,
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
        PromocodeBotUpdate,
        AuthMirrorUpdate,
        PaymentUpdate,
    ],
})
export class TelegramModule {}
