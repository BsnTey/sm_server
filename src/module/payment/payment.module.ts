import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentRepository } from './payment.repository';
import { HttpModule } from '../http/http.module';
import { BottModule } from '../bott/bott.module';
import { CouponModule } from '../coupon/coupon.module';

@Module({
    controllers: [PaymentController],
    providers: [PaymentService, PaymentRepository],
    exports: [PaymentService],
    imports: [BottModule, HttpModule, CouponModule],
})
export class PaymentModule {}
