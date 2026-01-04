import { Module } from '@nestjs/common';
import { DeviceGeneratorService } from '@core/device/services/device-generator.service';

@Module({
    providers: [DeviceGeneratorService],
    exports: [DeviceGeneratorService],
})
export class DeviceModule {}
