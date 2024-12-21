import { Module } from '@nestjs/common';
import { MirrorController } from './mirror.controller';
import { AccountModule } from '../account/account.module';
import { JwtService } from '@nestjs/jwt';
import { MirrorService } from './mirror.service';
import { MirrorRepository } from './mirror.repository';
import { ConfigService } from '@nestjs/config';

@Module({
    imports: [AccountModule],
    controllers: [MirrorController],
    providers: [JwtService, MirrorService, MirrorRepository, ConfigService],
    exports: [MirrorService, JwtService, ConfigService],
})
export class MirrorModule {}
