import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { AccountModule } from '../account/account.module';

@Module({
    imports: [AccountModule],
    providers: [CronService],
})
export class CronModule {}
