import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { CheckingService } from './checking.service';
import { CheckingController } from './checking.controller';

@Module({
    imports: [UserModule],
    providers: [CheckingService, CheckingController],
})
export class CheckingModule { }
