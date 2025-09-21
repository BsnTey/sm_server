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
import { GetInfoOrderUpdate, ProfileUpdate } from './updates/profile/profile.update';
import { AdminUpdate } from './updates/admin/admin.update';
import { AuthMirrorUpdate } from './updates/auth-mirror/auth-mirror.update';
import { PaymentPromocodeUpdate, PaymentUpdate } from './updates/payment/payment.update';
import { AccountModule } from '../account/account.module';
import { ProxyModule } from '../proxy/proxy.module';
import { SharedModule } from '../shared/shared.module';
import { HttpModule } from '../http/http.module';
import { UserModule } from '../user/user.module';
import { PaymentModule } from '../payment/payment.module';
import { MirrorModule } from '../mirror/mirror.module';
import { CouponModule } from '../coupon/coupon.module';
import { FortuneUpdate } from './updates/fortune/fortune.update';
import {
    CalculateSettingsScene,
    CommissionRateScene,
    CommissionTypeScene,
    CustomRoundScene,
    RoundToScene,
    TemplateNameScene,
    TemplateTextScene,
} from './updates/calculate/calculate-settings.update';
import { CalculateService } from './updates/calculate/calculate.service';
import { CalculateRepository } from './updates/calculate/calculate.repository';
import { FamilyInputAccountUpdate, FamilyInviteUpdate, FamilyUpdate } from './updates/family/family.update';
import { FamilyService } from './updates/family/family.service';

@Module({
    imports: [AccountModule, ProxyModule, SharedModule, HttpModule, UserModule, PaymentModule, MirrorModule, CouponModule],
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
        AuthMirrorUpdate,
        PaymentUpdate,
        PaymentPromocodeUpdate,
        FortuneUpdate,
        CalculateService,
        CalculateRepository,
        CalculateSettingsScene,
        TemplateNameScene,
        TemplateTextScene,
        CommissionTypeScene,
        CommissionRateScene,
        RoundToScene,
        CustomRoundScene,
        FamilyUpdate,
        FamilyInputAccountUpdate,
        FamilyInviteUpdate,
        FamilyService,
    ],
    exports: [TelegramService],
})
export class TelegramModule {}
