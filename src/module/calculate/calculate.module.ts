import { Module } from '@nestjs/common';
import { CalculateService } from './calculate.service';

@Module({
    providers: [CalculateService],
    exports: [CalculateService],
})
export class CalculateModule {}
