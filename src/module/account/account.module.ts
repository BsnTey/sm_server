import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountRepository } from './account.repository';
import { SportmasterHeadersService } from './entities/headers.entity';
import { ProxyModule } from '../proxy/proxy.module';
import { HttpModule } from '../http/http.module';
import { CourseService } from './course.service';
import { CourseRepository } from './course.repository';
import { DeviceInfoService } from './deviceInfo.service';
import { DeviceInfoRepository } from './deviceInfo.repository';
import { CalculateModule } from '../calculate/calculate.module';
import { DeviceModule } from '@core/device/device.module';
import { ProtectionToken } from './protection-token.service';
import { BrowserModule } from '../../shared/browser/browser.module';

@Module({
    imports: [ProxyModule, HttpModule, CalculateModule, DeviceModule, BrowserModule],
    controllers: [AccountController],
    providers: [
        AccountService,
        AccountRepository,
        SportmasterHeadersService,
        CourseService,
        CourseRepository,
        DeviceInfoService,
        DeviceInfoRepository,
        ProtectionToken,
    ],
    exports: [AccountService, SportmasterHeadersService, CourseService],
})
export class AccountModule {}
