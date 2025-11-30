import { Controller, Get, Patch, Param, Query, Body, HttpCode, Delete, Post } from '@nestjs/common';
import { HasZenno } from '@common/decorators/zenno.decorator';
import { ProxyService } from './proxy.service';
import { GetProxiesQueryDto } from './dto/query.dto';
import { UpdateProxyDto } from './dto/update-proxy.dto';
import { CreateProxiesDto } from './dto/create-proxies.dto';

@Controller('proxies')
export class ProxyController {
    constructor(private readonly service: ProxyService) { }

    @HasZenno()
    @Get()
    @HttpCode(200)
    async list(@Query() q: GetProxiesQueryDto) {
        return this.service.listProxies({ page: q.page, limit: q.limit });
    }

    @HasZenno()
    @Patch(':uuid')
    @HttpCode(200)
    async update(@Param('uuid') uuid: string, @Body() dto: UpdateProxyDto) {
        return this.service.updateProxy(uuid, dto);
    }

    @HasZenno()
    @Delete()
    @HttpCode(200)
    async clearAll() {
        return this.service.clearAllProxies();
    }

    @HasZenno()
    @Post()
    @HttpCode(201)
    async createMany(@Body() dto: CreateProxiesDto) {
        return this.service.addProxies(dto);
    }
}
