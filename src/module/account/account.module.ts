import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountRepository } from './account.repository';
import { SportmasterHeadersService } from './entities/headers.entity';
import { ProxyModule } from '../proxy/proxy.module';
import { HttpModule } from '../http/http.module';
import { CourseService } from './course.service';
import { CourseRepository } from './course.repository';

@Module({
    controllers: [AccountController],
    providers: [AccountService, AccountRepository, SportmasterHeadersService, CourseService, CourseRepository],
    exports: [AccountService, SportmasterHeadersService],
    imports: [ProxyModule, HttpModule],
})
export class AccountModule {}
