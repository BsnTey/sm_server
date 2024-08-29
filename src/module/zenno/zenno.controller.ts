import { Body, Controller, Get, HttpCode, Patch } from '@nestjs/common';
import { HasZenno } from '@common/decorators/zenno.decorator';
import { ZennoService } from './zenno.service';
import { ZennoConfigDto } from './dto/config.dto';

@Controller('zenno')
export class ZennoController {
    constructor(private zennoService: ZennoService) {}

    @HasZenno()
    @Patch('/config')
    @HttpCode(200)
    async updateZennoConfig(@Body() dto: ZennoConfigDto): Promise<ZennoConfigDto> {
        return await this.zennoService.updateZennoConfig(dto);
    }

    @HasZenno()
    @Get('/config')
    @HttpCode(200)
    async getZennoConfig(): Promise<ZennoConfigDto> {
        return await this.zennoService.getZennoConfig();
    }
}
