import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { CourseWorkService } from './courses.service';
import { CoursePurchaseService } from './course-purchase.service';
import { BottModule } from '../bott/bott.module';
import { PaymentModule } from '../payment/payment.module';
import { UserModule } from '../user/user.module';

@Module({
    imports: [AccountModule, BottModule, PaymentModule, UserModule],
    providers: [CourseWorkService, CoursePurchaseService],
    exports: [CourseWorkService, CoursePurchaseService],
})
export class CourseModule {}
