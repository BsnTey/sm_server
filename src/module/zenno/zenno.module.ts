import { Module } from '@nestjs/common';
import { ZennoController } from './zenno.controller';
import { ZennoService } from './zenno.service';
import { ZennoRepository } from './zenno.repository';

@Module({
    controllers: [ZennoController],
    providers: [ZennoService, ZennoRepository],
})
export class ZennoModule {}
