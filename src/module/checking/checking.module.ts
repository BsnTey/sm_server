import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { CheckingService } from './checking.service';
import { CheckingController } from './checking.controller';
import { AccountDiscountService } from './account-discount.service';
import { AccountModule } from '../account/account.module';
import { AccountDiscountRepository } from './account-discount.repository';
import { OrderModule } from '../order/order.module';
import { CalculateModule } from '../calculate/calculate.module';

@Module({
    imports: [UserModule, AccountModule, OrderModule, CalculateModule],
    providers: [CheckingService, AccountDiscountService, AccountDiscountRepository],
    controllers: [CheckingController],
    exports: [CheckingService],
})
export class CheckingModule {}
