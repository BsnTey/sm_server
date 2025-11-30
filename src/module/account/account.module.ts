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
import { AccountDiscountRepository } from '../checking/account-discount.repository';
import { CalculateModule } from '../calculate/calculate.module';
import { OrderRepository } from './order.repository';
import { AccountDiscountService } from '../checking/account-discount.service';

@Module({
    controllers: [AccountController],
    providers: [
        AccountService,
        AccountRepository,
        AccountDiscountRepository,
        SportmasterHeadersService,
        CourseService,
        CourseRepository,
        OrderRepository,
        DeviceInfoService,
        DeviceInfoRepository,
        AccountDiscountService,
    ],
    exports: [AccountService, SportmasterHeadersService, CourseService, AccountDiscountService],
    imports: [ProxyModule, HttpModule, CalculateModule],
})
export class AccountModule {}
