import { Module } from '@nestjs/common';
import { CheckingService } from './checking.service';
import { CheckingGateway } from './checking.gateway';

@Module({
  providers: [CheckingService, CheckingGateway]
})
export class CheckingModule {}
