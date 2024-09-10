import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { AccountService } from './account.service';
import { HasZenno } from '@common/decorators/zenno.decorator';
import { AddingAccountRequestDto, AddingAccountResponseDto } from './dto/create-account.dto';
import { UpdatingAccountRequestDto, UpdatingAccountResponseDto } from './dto/update-tokens-account.dto';
import { AccountIdParamsDto } from './dto/uuid-account.dto';
import { UpdateAccountRequestDto, UpdateAccountResponseDto } from './dto/update-account.dto';
import { IsEmailRequestDto, IsEmailResponseDto } from './dto/isEmail-account.dto';
import { Account } from '@prisma/client';
import { UpdatingBonusCountRequestDto, UpdatingBonusCountResponseDto } from './dto/updateBonusCount-account.dto';
import { UpdatePushTokenRequestDto, UpdatePushTokenResponseDto } from './dto/updatePushToken-account.dto';
import { UpdateGoogleIdRequestDto, UpdateGoogleIdResponseDto } from './dto/updateGoogleId-account.dto';
import { AccessTokenCourseResponseDto } from './dto/getAccessTokenCourse-account.dto';

@Controller('account')
export class AccountController {
    constructor(private accountService: AccountService) {}

    @HasZenno()
    @Post()
    @HttpCode(200)
    async addAccount(@Body() dto: AddingAccountRequestDto): Promise<AddingAccountResponseDto> {
        const account = await this.accountService.addingAccount(dto);
        return account ? 'success' : 'error';
    }

    @HasZenno()
    @Get(':accountId')
    @HttpCode(200)
    async getAccount(@Param() params: AccountIdParamsDto): Promise<Account> {
        const accountEntity = await this.accountService.getAccount(params.accountId);
        return {
            ...accountEntity,
            cookie: JSON.parse(accountEntity.cookie),
        };
    }

    @HasZenno()
    @Patch(':accountId/token')
    @HttpCode(200)
    async updateTokenAccount(
        @Body() dto: UpdatingAccountRequestDto,
        @Param() params: AccountIdParamsDto,
    ): Promise<UpdatingAccountResponseDto> {
        const account = await this.accountService.updateTokensAccount(params.accountId, dto);
        return account ? 'success' : 'error';
    }

    @HasZenno()
    @Put(':accountId')
    @HttpCode(200)
    async updateAccount(@Body() dto: UpdateAccountRequestDto, @Param() params: AccountIdParamsDto): Promise<UpdateAccountResponseDto> {
        const account = await this.accountService.updateAccount(params.accountId, dto);
        return account ? 'success' : 'error';
    }

    @HasZenno()
    @Post('isEmail')
    @HttpCode(200)
    async isEmail(@Body() dto: IsEmailRequestDto): Promise<IsEmailResponseDto> {
        const isEmail = await this.accountService.findAccountByEmail(dto.email);
        return { isEmail: !!isEmail };
    }

    @HasZenno()
    @Patch(':accountId/bonusCount')
    @HttpCode(200)
    async updateBonusCountAccount(
        @Body() dto: UpdatingBonusCountRequestDto,
        @Param() params: AccountIdParamsDto,
    ): Promise<UpdatingBonusCountResponseDto> {
        const account = await this.accountService.updateAccountBonusCount(params.accountId, dto);
        return account ? 'success' : 'error';
    }

    @HasZenno()
    @Patch(':accountId/pushToken')
    @HttpCode(200)
    async updatePushTokenAccount(
        @Body() dto: UpdatePushTokenRequestDto,
        @Param() params: AccountIdParamsDto,
    ): Promise<UpdatePushTokenResponseDto> {
        return await this.accountService.updatePushToken(params.accountId, dto);
    }

    @HasZenno()
    @Patch(':accountId/googleId')
    @HttpCode(200)
    async updateGoogleIdAccount(
        @Body() dto: UpdateGoogleIdRequestDto,
        @Param() params: AccountIdParamsDto,
    ): Promise<UpdateGoogleIdResponseDto> {
        return await this.accountService.updateGoogleId(params.accountId, dto);
    }

    @HasZenno()
    @Get(':accountId/accessTokenCourse')
    @HttpCode(200)
    async getAccessTokenCourseAccount(@Param() params: AccountIdParamsDto): Promise<AccessTokenCourseResponseDto> {
        return await this.accountService.getAccessTokenCourse(params.accountId);
    }

    @HasZenno()
    @Get(':accountId/courses')
    @HttpCode(200)
    async getCoursesAccount(@Param() params: AccountIdParamsDto): Promise<any> {
        return await this.accountService.getCoursesList(params.accountId);
    }
}
