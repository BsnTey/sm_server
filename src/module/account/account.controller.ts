import { Body, Controller, Get, HttpCode, NotFoundException, Param, Patch, Post, Put } from '@nestjs/common';
import { AccountService } from './account.service';
import { HasZenno } from '@common/decorators/zenno.decorator';
import { AddingAccountRequestDto } from './dto/create-account.dto';
import { UpdatingAccountRequestDto } from './dto/update-tokens-account.dto';
import { AccountIdParamsDto } from './dto/uuid-account.dto';
import { UpdateAccountRequestDto, UpdateAccountResponseDto } from './dto/update-account.dto';
import { IsEmailRequestDto, IsEmailResponseDto } from './dto/isEmail-account.dto';
import { Account } from '@prisma/client';
import { UpdatingBonusCountRequestDto, UpdatingBonusCountResponseDto } from './dto/updateBonusCount-account.dto';
import { UpdatePushTokenRequestDto, UpdatePushTokenResponseDto } from './dto/updatePushToken-account.dto';
import { UpdateGoogleIdRequestDto, UpdateGoogleIdResponseDto } from './dto/updateGoogleId-account.dto';
import { AxiosError } from 'axios';
import { UpdatingCourseTokensAccountRequestDto } from './dto/update-course-tokens-account.dto';
import { CourseService } from './course.service';
import { UpdateCourseStatusRequestDto } from './dto/updateCourseStatus-course';
import { CourseData } from './interfaces/course-data.interface';
import { ERROR_ACCOUNT_NOT_FOUND } from './constants/error.constant';
import { UpdatingCookieRequestDto, UpdatingCookieResponseDto } from './dto/updateCookie-account.dto';
import { DeviceInfoRequestDto, DeviceInfoResponseDto } from './dto/create-deviceInfo.dto';
import { DeviceInfoService } from './deviceInfo.service';
import { CourseIdAccountRequestDto } from './dto/course-account.dto';
import { UpdatingCourseStatusAccountRequestDto } from './dto/update-course-status-account.dto';

@Controller('account')
export class AccountController {
    constructor(
        private accountService: AccountService,
        private courseService: CourseService,
        private deviceInfoService: DeviceInfoService,
    ) {}

    @HasZenno()
    @Post()
    @HttpCode(200)
    async addAccount(@Body() dto: AddingAccountRequestDto): Promise<string> {
        const account = await this.accountService.addingAccount(dto);
        return account ? 'success' : 'error';
    }

    @HasZenno()
    @Get(':accountId')
    @HttpCode(200)
    async getAccount(@Param() params: AccountIdParamsDto): Promise<Account> {
        const accountEntity = await this.accountService.getFullAccount(params.accountId);
        return {
            ...accountEntity,
            cookie: JSON.parse(accountEntity.cookie),
        };
    }

    @HasZenno()
    @Patch(':accountId/token')
    @HttpCode(200)
    async updateTokenAccount(@Body() dto: UpdatingAccountRequestDto, @Param() params: AccountIdParamsDto): Promise<string> {
        const account = await this.accountService.updateTokensAccount(params.accountId, dto);
        return account ? 'success' : 'error';
    }

    @HasZenno()
    @Patch('/course/token/:accountId')
    @HttpCode(200)
    async updateCourseTokenAccount(
        @Body() dto: UpdatingCourseTokensAccountRequestDto,
        @Param() params: AccountIdParamsDto,
    ): Promise<string> {
        const account = await this.accountService.updateCourseTokensAccount(params.accountId, dto);
        return account ? 'success' : 'error';
    }

    @HasZenno()
    @Patch('course/status/:accountId')
    @HttpCode(200)
    async updateCourseStatusAccount(
        @Body() dto: UpdatingCourseStatusAccountRequestDto,
        @Param() params: AccountIdParamsDto,
    ): Promise<string> {
        const account = await this.accountService.updateStatusAccountCourseDto(params.accountId, dto);
        return account ? 'success' : 'error';
    }

    @HasZenno()
    @Post('course/activate/:accountId')
    @HttpCode(200)
    async activateCourseAccount(@Body() dto: CourseIdAccountRequestDto, @Param() params: AccountIdParamsDto): Promise<string> {
        const account = await this.accountService.activateCourseAccount(params.accountId, dto);
        return account ? 'success' : 'error';
    }

    @HasZenno()
    @Get('courses/isconnection/:accountId')
    @HttpCode(200)
    async isCourseAddingAccount(@Param() params: AccountIdParamsDto): Promise<any> {
        const courses = await this.accountService.getAccountCoursesOrSynchronized(params.accountId);
        if (courses.length != 0) return;
        throw new NotFoundException(ERROR_ACCOUNT_NOT_FOUND);
    }

    @HasZenno()
    @Post('courses/connection/:accountId')
    @HttpCode(200)
    async connectionCourseAccount(@Param() params: AccountIdParamsDto): Promise<void> {
        await this.accountService.connectionCourseAccount(params.accountId);
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
    @Patch(':accountId/cookie')
    @HttpCode(200)
    async updateCookieAccount(
        @Body() dto: UpdatingCookieRequestDto,
        @Param() params: AccountIdParamsDto,
    ): Promise<UpdatingCookieResponseDto> {
        return await this.accountService.updateCookie(params.accountId, dto);
    }

    // @HasZenno()
    // @Get(':accountId/accessTokenCourse')
    // @HttpCode(200)
    // async getAccessTokenCourseAccount(@Param() params: AccountIdParamsDto): Promise<AccessTokenCourseResponseDto> {
    //     return await this.accountService.getAccessTokenCourse(params.accountId);
    // }

    @HasZenno()
    @Get(':accountId/courses')
    @HttpCode(200)
    async getCoursesAccount(@Param() params: AccountIdParamsDto): Promise<any> {
        return await this.accountService.getCoursesList(params.accountId);
    }

    @Get('checking/:accountId')
    @HttpCode(200)
    async getBonusAccount(@Param() params: AccountIdParamsDto): Promise<any> {
        try {
            return await this.accountService.shortInfo(params.accountId);
        } catch (err: any) {
            return this.handleError(err);
        }
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

    @HasZenno()
    @Patch('courses/status/:accountId')
    @HttpCode(200)
    async courseUnblock(@Body() dto: UpdateCourseStatusRequestDto, @Param() params: AccountIdParamsDto): Promise<void> {
        await this.courseService.changeStatusCourse(params.accountId, dto.courseId, dto.status);
    }

    @HasZenno()
    @Post('courses/synchronization/:accountId')
    @HttpCode(200)
    async synchronizationCourse(@Body() data: CourseData, @Param() params: AccountIdParamsDto): Promise<string> {
        return this.courseService.synchronizationCourse(params.accountId, data);
    }

    @HasZenno()
    @Post(':accountId/device')
    @HttpCode(200)
    async addDeviceInfo(@Param() params: AccountIdParamsDto, @Body() deviceInfoDto: DeviceInfoRequestDto): Promise<DeviceInfoResponseDto> {
        return this.accountService.addDeviceInfo(params.accountId, deviceInfoDto);
    }

    @HasZenno()
    @Put(':accountId/device')
    @HttpCode(200)
    async updateDeviceInfo(
        @Param() params: AccountIdParamsDto,
        @Body() deviceInfoDto: DeviceInfoRequestDto,
    ): Promise<DeviceInfoResponseDto> {
        return this.deviceInfoService.updateDeviceInfo(params.accountId, deviceInfoDto);
    }
}
