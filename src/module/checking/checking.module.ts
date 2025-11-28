import { Module } from '@nestjs/common';
import { CheckingService } from './checking.service';
import { CheckingController } from './checking.controller';

@Module({
    providers: [CheckingService, CheckingController],
})
export class CheckingModule {}
