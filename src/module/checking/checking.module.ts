import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { CheckingService } from './checking.service';
import { CheckingController } from './checking.controller';
import { TelegramModule } from '../telegram/telegram.module';
import { AccountDiscountService } from './account-discount.service';

@Module({
    imports: [UserModule, TelegramModule],
    providers: [CheckingService, CheckingController, AccountDiscountService],
})
export class CheckingModule { }
