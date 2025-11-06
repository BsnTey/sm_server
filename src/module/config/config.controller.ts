import { Controller, Get, HttpCode } from '@nestjs/common';
import { ConfigAppService } from './config.service';

@Controller('config')
export class ConfigAppController {
    constructor(private configAppService: ConfigAppService) {}

    @Get('extension')
    @HttpCode(200)
    async getConfigExtension() {
        return this.configAppService.getConfigExtension();
    }
}
