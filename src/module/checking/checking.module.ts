import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { CheckingService } from './checking.service';
import { CheckingController } from './checking.controller';
import { AccountDiscountService } from './account-discount.service';
import { AccountModule } from '../account/account.module';
import { AccountDiscountRepository } from './account-discount.repository';
import { OrderModule } from '../order/order.module';
import { CalculateModule } from '../calculate/calculate.module';
import { AdminDiscountService } from './admin-discount.service';

@Module({
    imports: [UserModule, AccountModule, OrderModule, CalculateModule],
    providers: [CheckingService, AccountDiscountService, AccountDiscountRepository, AdminDiscountService],
    controllers: [CheckingController],
    exports: [CheckingService, AccountDiscountService],
})
export class CheckingModule {}
