import { Module } from '@nestjs/common';
import { ConfigAppController } from './config.controller';
import { ConfigAppService } from './config.service';

@Module({
    controllers: [ConfigAppController],
    providers: [ConfigAppService],
})
export class ConfigAppModule {}
