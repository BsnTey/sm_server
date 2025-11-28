import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { TelegramIdParamsDto } from '../account/dto/telegramId.dto';
import { SetPersonalDiscountAccountRequestDto } from './dto/set-personal-discount.dto';
import { ProductCheckingRequestDto } from './dto/product-checking.dto';
import { AccountTelegramParamsDto } from '../account/dto/account-telegram-ids.dto';
import { CheckProductBatchRequestDto, PrepareProductCheckRequestDto } from './dto/check-product.prepare.dto';
import { CheckingService } from './checking.service';

@Controller('checking')
export class CheckingController {
    constructor(private checkingService: CheckingService) {}

    @Post('personal-discount/v1/set')
    @HttpCode(200)
    async setAccountsForPersonalDiscountV1(@Body() data: SetPersonalDiscountAccountRequestDto) {
        return this.checkingService.queueAccountsForPersonalDiscountV1(data);
    }

    @Patch('personal-discount/v1/update')
    @HttpCode(200)
    async updateAccountsForPersonalDiscount(@Body() data: SetPersonalDiscountAccountRequestDto) {
        return this.checkingService.updateAccountsForPersonalDiscount(data);
    }

    @Delete('personal-discount/v1/:telegramId/:accountId')
    @HttpCode(200)
    async delDiscountsByAccountIdV1(@Param() params: AccountTelegramParamsDto) {
        return this.checkingService.removeDiscountsByAccountIdV1(params);
    }

    @Delete('personal-discount/v1/:telegramId')
    @HttpCode(200)
    async delAccounts(@Param() params: AccountTelegramParamsDto) {
        return this.checkingService.delAccounts(params);
    }

    @Get('personal-discount/nodes/:telegramId')
    @HttpCode(200)
    async getDistinctNodePairsByTelegram(@Param() params: TelegramIdParamsDto) {
        return this.checkingService.getDistinctNodePairsByTelegram(params.telegramId);
    }

    @Post('personal-discount/v1/prepare/accounts')
    @HttpCode(200)
    async prepareAccountsForProductCheckV1(@Body() data: PrepareProductCheckRequestDto) {
        return this.checkingService.prepareAccountsForProductCheckV1(data);
    }

    @Post('personal-discount/v1/batch')
    @HttpCode(200)
    async checkProductBatchForPersonalDiscount(@Body() data: CheckProductBatchRequestDto) {
        return this.checkingService.checkProductBatchForPersonalDiscount(data);
    }

    //роуты версии через очередь
    @Post('personal-discount/v2/stream')
    @HttpCode(200)
    async getAccountsForPersonalDiscountV2(@Body() data: ProductCheckingRequestDto) {
        return this.checkingService.getAccountsForPersonalDiscountV2(data.telegramId, data.productId);
    }

    @Get('personal-discount/v1/accounts/:telegramId')
    @HttpCode(200)
    async getUserAccountIdsV2(@Param() params: TelegramIdParamsDto) {
        return this.checkingService.getUserAccountIdsV2(params.telegramId);
    }
}
