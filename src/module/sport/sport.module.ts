import { Module } from '@nestjs/common';
import { SportService } from './sport.service';
import { SportRepository } from './sport.repository';

@Module({
    providers: [SportService, SportRepository],
})
export class SportModule {}
