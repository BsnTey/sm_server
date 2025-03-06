import { Body, Controller, Get, HttpCode, Patch } from '@nestjs/common';
import { HasZenno } from '@common/decorators/zenno.decorator';
import { ZennoService } from './zenno.service';
import { ZennoConfigDto } from './dto/config.dto';
import { ZennoConfigDtoV2 } from './dto/configV2.dto';

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
    @Patch('/v2/config')
    @HttpCode(200)
    async updateZennoConfigV2(@Body() dto: ZennoConfigDtoV2) {
        return await this.zennoService.updateZennoConfigV2(dto);
    }

    @HasZenno()
    @Get('/config')
    @HttpCode(200)
    async getZennoConfig(): Promise<ZennoConfigDto> {
        return await this.zennoService.getZennoConfig();
    }

    @HasZenno()
    @Get('/v2/config')
    @HttpCode(200)
    async getZennoConfigV2() {
        return await this.zennoService.getZennoConfigV2();
    }
}
