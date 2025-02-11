import { Module } from '@nestjs/common';
import { FortuneCouponService } from './fortune-coupon.service';
import { FortuneCouponRepository } from './forune-coupon.repository';
import { BottModule } from '../bott/bott.module';

@Module({
    imports: [BottModule],
    exports: [FortuneCouponService],
    providers: [FortuneCouponService, FortuneCouponRepository],
})
export class CouponModule {}
