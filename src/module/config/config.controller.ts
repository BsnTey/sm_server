import { Controller, Get, HttpCode, Redirect } from '@nestjs/common';
import { ConfigAppService } from './config.service';

@Controller('config')
export class ConfigAppController {
    constructor(private configAppService: ConfigAppService) {}

    @Get('extension')
    @HttpCode(200)
    async getConfigExtension() {
        return this.configAppService.getConfigExtension();
    }

    @Get('extension/v1')
    @HttpCode(200)
    async getConfigExtensionV1() {
        return this.configAppService.getConfigExtensionV1();
    }
}
