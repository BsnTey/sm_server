import { Body, Controller, Delete, Get, Param, HttpCode, Patch, Post, Query, NotFoundException } from '@nestjs/common';
import { SetPersonalDiscountAccountRequestDto } from './dto/set-personal-discount.dto';
import { CheckingService } from './checking.service';
import { TgPersonalDiscountDto } from './dto/tg-personal-discount.dto';
import { DeleteAccountRequestDto } from './dto/delete-account.dto';
import { AccountDiscountService } from './account-discount.service';
import { TelegramIdParamsDto } from '../account/dto/telegramId.dto';
import { CheckProductBatchRequestDto, PrepareProductCheckRequestDto } from './dto/check-product.prepare.dto';
import { ProductCheckingRequestDto } from './dto/product-checking.dto';
import { HasZenno } from '@common/decorators/zenno.decorator';
import { AdminDiscountService } from './admin-discount.service';
import { AccountService } from '../account/account.service';
import { AccountIdParamsDto } from '../account/dto/uuid-account.dto';
import { AxiosError } from 'axios';
import { OrderService } from '../order/order.service';

@Controller('checking')
export class CheckingController {
    constructor(
        private checkingService: CheckingService,
        private orderService: OrderService,
        private accountDiscountService: AccountDiscountService,
        private adminDiscountService: AdminDiscountService,
        private accountService: AccountService,
    ) {}

    @Get('short-info/:accountId')
    @HttpCode(200)
    async getBonusAccount(@Param() params: AccountIdParamsDto): Promise<any> {
        try {
            this.orderService.orderHistory(params.accountId).catch(() => {
                // ignore
            });
            return this.accountService.shortInfo(params.accountId);
        } catch (err: any) {
            return this.handleError(err);
        }
    }

    @Post('personal-discount/v1/set')
    @HttpCode(200)
    async setAccountsForPersonalDiscountV1(@Body() data: SetPersonalDiscountAccountRequestDto) {
        return this.checkingService.queueAccountsForPersonalDiscountV1(data);
    }

    @Patch('personal-discount/v1/update')
    @HttpCode(200)
    async updateAccountsForPersonalDiscount(@Body() data: TgPersonalDiscountDto) {
        return this.checkingService.updatePersonalDiscountByTelegram(data);
    }

    @Delete('personal-discount/all/:telegramId')
    @HttpCode(200)
    async deleteAllByTelegramId(@Param() data: TgPersonalDiscountDto) {
        return this.accountDiscountService.deleteAllByTelegramId(data.telegramId);
    }

    @Delete('personal-discount/single')
    @HttpCode(200)
    async delSingleDiscountByAccountId(@Query() data: DeleteAccountRequestDto) {
        const delAccountIds = [data.accountId];
        return this.accountDiscountService.deleteAccountDiscountsBatch(delAccountIds, data.telegramId);
    }

    @Get('personal-discount/nodes/:telegramId')
    @HttpCode(200)
    async getDistinctNodePairsByTelegram(@Param() params: TelegramIdParamsDto) {
        return this.accountDiscountService.getDistinctNodePairsByTelegram(params.telegramId);
    }

    @Post('personal-discount/v1/prepare/accounts')
    @HttpCode(200)
    async prepareAccountsForProductCheckV1(@Body() data: PrepareProductCheckRequestDto) {
        return this.checkingService.prepareAccountsForProductCheckV1(data);
    }

    @Post('personal-discount/v2/batch')
    @HttpCode(200)
    async checkProductBatchForPersonalDiscount(@Body() data: CheckProductBatchRequestDto) {
        return this.checkingService.checkProductBatchForPersonalDiscount(data);
    }

    @Post('personal-discount/v3/stream')
    @HttpCode(200)
    async getAccountsForPersonalDiscountV2(@Body() data: ProductCheckingRequestDto) {
        return this.checkingService.getAccountsForPersonalDiscountV3(data.telegramId, data.productId);
    }

    @Get('personal-discount/v1/accounts/:telegramId')
    @HttpCode(200)
    async getUserAccountIdsV2(@Param() params: TelegramIdParamsDto) {
        return this.accountDiscountService.findAccountsByTelegramUser(params.telegramId);
    }

    // ===================== ADMIN ROUTES =====================

    /**
     * Полная очистка всех таблиц скидок + кеш Redis
     */
    @Delete('admin/full-cleanup')
    @HttpCode(200)
    @HasZenno()
    async fullCleanup() {
        return this.adminDiscountService.fullCleanup();
    }

    /**
     * Обновление данных: сохранить аккаунты, очистить всё, заново загрузить
     */
    @Post('admin/refresh-all')
    @HttpCode(200)
    @HasZenno()
    async refreshAllDiscountData() {
        return this.adminDiscountService.refreshAllDiscountData();
    }

    private handleError(err: any): { error: string } {
        let errorMessage = '';
        if (err instanceof NotFoundException) {
            errorMessage = `Не найден`;
        } else if (err instanceof AxiosError) {
            const errorResponse = err.response?.data?.error;
            errorMessage = errorResponse?.message || 'Ошибка запроса, повторите';
        } else {
            errorMessage = err.message || 'Неизвестная ошибка';
        }
        return { error: errorMessage };
    }
}
