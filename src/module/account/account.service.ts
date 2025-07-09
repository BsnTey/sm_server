import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRepository } from './account.repository';
import { AddingAccountRequestDto } from './dto/create-account.dto';
import { AccountEntity } from './entities/account.entity';
import { AccountWDevice, IAccountWithProxy, IFindCitiesAccount, IRecipientOrder, IRefreshAccount } from './interfaces/account.interface';
import { CourseStatus, LessonStatus, Order } from '@prisma/client';
import { ProxyService } from '../proxy/proxy.service';
import {
    ERROR_ACCESS_TOKEN_COURSE,
    ERROR_ACCOUNT_NOT_FOUND,
    ERROR_COURSE_NOT_FOUND,
    ERROR_GET_ACCESS_TOKEN_COURSE,
    ERROR_LOGOUT_MP,
    ERROR_PROGRESS_ID,
} from './constants/error.constant';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../http/http.service';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { AccountWithProxyEntity } from './entities/accountWithProxy.entity';
import { CitySMEntity } from './entities/citySM.entity';
import { CartInterface } from './interfaces/cart.interface';
import { IItemsCart, selectMainFromCart } from '../telegram/utils/cart.utils';
import { SearchProductInterface } from './interfaces/search-product.interface';
import { PickupAvabilityInterface } from './interfaces/pickup-avability.interface';
import { OrdersInterface } from './interfaces/orders.interface';
import { OrderInfoInterface } from './interfaces/order-info.interface';
import { ShortInfoInterface } from './interfaces/short-info.interface';
import { PromocodeInterface } from './interfaces/promocode.interface';
import { RefreshTokensEntity } from './entities/refreshTokens.entity';
import { UpdateAccountRequestDto } from './dto/update-account.dto';
import { AccountUpdateEntity } from './entities/accountUpdate.entity';
import { UpdatingBonusCountRequestDto } from './dto/updateBonusCount-account.dto';
import { UpdatePushTokenRequestDto } from './dto/updatePushToken-account.dto';
import { UpdateGoogleIdRequestDto } from './dto/updateGoogleId-account.dto';
import { v4 as uuidv4 } from 'uuid';
import { SportmasterHeadersService } from './entities/headers.entity';
import { UserGateTokenInterface } from './interfaces/userGateToken.interface';
import { CourseList } from './interfaces/course-list.interface';
import { CourseService } from './course.service';
import { CourseWithLessons, IWatchLesson } from './interfaces/course.interface';
import { CourseTokensEntity } from './entities/courseTokens.entity';
import { UpdatingCourseTokensAccountRequestDto } from './dto/update-course-tokens-account.dto';
import { UpdatingCookieRequestDto } from './dto/updateCookie-account.dto';
import { DeviceInfoService } from './deviceInfo.service';
import { IDeviceInfo } from './interfaces/deviceInfo.interface';
import { DeviceInfoRequestDto } from './dto/create-deviceInfo.dto';
import { CourseIdAccountRequestDto } from './dto/course-account.dto';
import { UpdatingCourseStatusAccountRequestDto } from './dto/update-course-status-account.dto';

@Injectable()
export class AccountService {
    private url = this.configService.getOrThrow('API_DONOR');
    private urlSite = this.configService.getOrThrow('API_DONOR_SITE');
    private adminsId: string[] = this.configService.getOrThrow('TELEGRAM_ADMIN_ID').split(',');
    private durationTimeProxyBlock = this.configService.getOrThrow('TIME_DURATION_PROXY_BLOCK_IN_MIN');

    constructor(
        private configService: ConfigService,
        private accountRep: AccountRepository,
        private proxyService: ProxyService,
        private httpService: HttpService,
        private courseService: CourseService,
        private deviceInfoService: DeviceInfoService,
        private sportmasterHeaders: SportmasterHeadersService,
    ) {}

    async addingAccount(accountDto: AddingAccountRequestDto): Promise<AccountEntity> {
        const {
            accountId,
            email,
            passImap,
            passEmail,
            cookie,
            accessToken,
            refreshToken,
            googleId,
            accessTokenCourse,
            refreshTokenCourse,
            userGateToken,
            xUserId,
            deviceId,
            installationId,
            expiresIn,
            bonusCount,
            isOnlyAccessOrder,
            statusCourse,
        } = accountDto;

        const refreshTokensEntity = new RefreshTokensEntity({ accessToken, refreshToken, expiresIn });

        const account = new AccountEntity({
            accountId,
            email,
            passImap,
            passEmail,
            cookie,
            accessToken: refreshTokensEntity.accessToken,
            refreshToken: refreshTokensEntity.refreshToken,
            accessTokenCourse,
            refreshTokenCourse,
            userGateToken,
            isValidAccessTokenCourse: true,
            statusCourse: statusCourse ? statusCourse : 'NONE',
            xUserId,
            deviceId,
            installationId,
            googleId,
            expiresInAccess: refreshTokensEntity.expiresInAccess,
            expiresInRefresh: refreshTokensEntity.expiresInRefresh,
            bonusCount: +bonusCount,
            isOnlyAccessOrder: Boolean(isOnlyAccessOrder),
            ownerTelegramId: this.adminsId[0],
        });
        await this.accountRep.addingAccount(account);
        await this.initializeAccountProgress(account.accountId);
        return account;
    }

    async initializeAccountProgress(accountId: string): Promise<void> {
        const courses = await this.courseService.getCoursesWithLessons();

        for (const course of courses) {
            await this.createAccountCourseAndLessons(accountId, course);
        }
    }

    async getAccountCoursesOrSynchronized(accountId: string): Promise<string[]> {
        const coursesInAccount = await this.courseService.getIsAccountCourses(accountId);
        if (coursesInAccount.length == 0) return [];
        const allCoursesId = this.courseService.coursesId;
        const notAvalibleCourses: string[] = [];

        for (const courseId of allCoursesId) {
            if (coursesInAccount.includes(courseId)) continue;
            notAvalibleCourses.push(courseId);
        }

        if (notAvalibleCourses.length != 0) {
            const courses = await this.courseService.getCoursesWithLessons();
            for (const courseId of notAvalibleCourses) {
                const course = courses.find(course => course.courseId == courseId);
                if (!course) throw new NotFoundException(ERROR_COURSE_NOT_FOUND);
                await this.createAccountCourseAndLessons(accountId, course);
            }
        }
        return coursesInAccount;
    }

    async createAccountCourseAndLessons(accountId: string, course: CourseWithLessons) {
        await this.courseService.createAccountCourse(accountId, course);
        await this.courseService.createAccountLessonProgress(accountId, course.lessons);
    }

    async getAccount(accountId: string): Promise<AccountEntity> {
        const account = await this.accountRep.getAccount(accountId);
        if (!account) throw new NotFoundException(ERROR_ACCOUNT_NOT_FOUND);

        return new AccountEntity(account);
    }

    async getAccountCookie(accountId: string) {
        const account = await this.accountRep.getAccountCookie(accountId);
        if (!account) throw new NotFoundException(ERROR_ACCOUNT_NOT_FOUND);

        return new AccountEntity(account);
    }

    async getFullAccount(accountId: string): Promise<AccountWDevice> {
        const account = await this.getAccount(accountId);

        let deviceInfo: IDeviceInfo | null = null;
        try {
            deviceInfo = await this.deviceInfoService.getDeviceInfo(accountId);
        } catch (error) {
            //null
        }

        return {
            ...account,
            deviceInfo,
        };
    }

    async findAccountEmail(accountId: string) {
        return await this.accountRep.getAccountEmail(accountId);
    }

    async findAccountByEmail(email: string) {
        return await this.accountRep.getEmail(email);
    }

    async findOrderNumber(orderNumber: string) {
        return await this.accountRep.getOrder(orderNumber);
    }

    async setBanMp(accountId: string) {
        return await this.accountRep.setBanMp(accountId);
    }

    async updateAccountBonusCount(accountId: string, data: UpdatingBonusCountRequestDto) {
        await this.getAccount(accountId);
        return await this.updateAccountBonusCountPrivate(accountId, data.bonusCount);
    }

    private async updateAccountBonusCountPrivate(accountId: string, bonusCount: number) {
        return await this.accountRep.updateBonusCount(accountId, bonusCount);
    }

    async updateAccount(accountId: string, dto: UpdateAccountRequestDto) {
        await this.getAccount(accountId);

        const updateAccountEntity = new AccountUpdateEntity(dto);
        return await this.accountRep.updateAccount(accountId, updateAccountEntity);
    }

    async updateTokensAccount(accountId: string, dataAccount: IRefreshAccount) {
        await this.getAccount(accountId);
        return await this.updateTokensAccountPrivate(accountId, dataAccount);
    }

    private async updateTokensAccountPrivate(accountId: string, dataAccount: IRefreshAccount): Promise<RefreshTokensEntity> {
        const refreshTokensEntity = new RefreshTokensEntity(dataAccount);
        await this.accountRep.updateTokensAccount(accountId, refreshTokensEntity);
        return refreshTokensEntity;
    }

    async updateCourseTokensAccount(accountId: string, data: UpdatingCourseTokensAccountRequestDto) {
        await this.getAccount(accountId);
        return await this.updateCourseTokensAccountPrivate(accountId, data);
    }

    async activateCourseAccount(accountId: string, { courseId }: CourseIdAccountRequestDto) {
        await this.getAccount(accountId);
        //активировать курс
        await this.courseService.changeStatusCourse(accountId, courseId, CourseStatus.ACTIVE);

        const progressIdFirstLesson = await this.courseService.getFirstLessonProgressId(accountId, courseId);
        if (!progressIdFirstLesson) throw new NotFoundException(ERROR_PROGRESS_ID);
        //активировать первый урок
        return this.courseService.updateViewLesson(progressIdFirstLesson, LessonStatus.NONE);
    }

    async updateStatusAccountCourseDto(accountId: string, { statusCourse }: UpdatingCourseStatusAccountRequestDto) {
        return await this.updateStatusAccountCourse(accountId, statusCourse);
    }

    async updateStatusAccountCourse(accountId: string, statusCourse: CourseStatus) {
        return await this.accountRep.updateStatusAccountCourse(accountId, statusCourse);
    }

    async connectionCourseAccount(accountId: string) {
        const account = await this.getAccount(accountId);

        await this.accountRep.addAccountCourses(accountId);
        const lessons = await this.courseService.getAllLesson();
        try {
            console.log('попытка в try');
            await this.courseService.createAccountLessonProgress(account.accountId, lessons);
        } catch (e) {
            console.log('попытка в catch');
            await this.initializeAccountProgress(account.accountId);
        }
    }

    private async updateCourseTokensAccountPrivate(
        accountId: string,
        dataAccount: UpdatingCourseTokensAccountRequestDto,
    ): Promise<CourseTokensEntity> {
        const courseTokensEntity = new CourseTokensEntity({
            ...dataAccount,
            isValidAccessTokenCourse: true,
        });
        await this.accountRep.updateCourseTokensAccount(accountId, courseTokensEntity);
        return courseTokensEntity;
    }

    async addDeviceInfo(accountId: string, deviceInfoDto: DeviceInfoRequestDto) {
        await this.getAccount(accountId);
        return this.deviceInfoService.addDeviceInfo(accountId, deviceInfoDto);
    }

    async updateGoogleId(accountId: string, data: UpdateGoogleIdRequestDto): Promise<{ googleId: string }> {
        await this.getAccount(accountId);

        const googleId = data.googleId || uuidv4();
        await this.accountRep.updateGoogleId(accountId, googleId);
        return { googleId };
    }

    async updateCookie(accountId: string, data: UpdatingCookieRequestDto): Promise<{ cookie: string }> {
        await this.getAccount(accountId);

        return this.accountRep.updateCookie(accountId, data.cookie);
    }

    async updatePushToken(accountId: string, data: UpdatePushTokenRequestDto): Promise<{ pushToken: string }> {
        await this.getAccount(accountId);

        const pushToken = data.pushToken || this.generateFCMLikeToken();
        await this.accountRep.updatePushToken(accountId, pushToken);
        return { pushToken };
    }

    async createAccessTokenCourse(accountWithProxyEntity: AccountWithProxyEntity): Promise<{
        accessTokenCourse: string;
    }> {
        if (!accountWithProxyEntity.userGateToken) {
            const respUserGateToken = await this.getUserGateToken(accountWithProxyEntity);
            const userGateToken = respUserGateToken.data.userGateToken;
            await this.accountRep.updateUserGateToken(accountWithProxyEntity.accountId, userGateToken);
            accountWithProxyEntity = await this.getAccountEntity(accountWithProxyEntity.accountId);
        }

        const htmlCourse = await this.getCoursesHtml(accountWithProxyEntity);

        const accessTokenCourse = this.getAccessTokenCourseFromResponse(htmlCourse);
        return { accessTokenCourse };
    }

    async getCoursesList(accountId: string): Promise<CourseList> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const { accessTokenCourse } = await this.createAccessTokenCourse(accountWithProxyEntity);
        return this.getCourses(accessTokenCourse, accountWithProxyEntity);
    }

    private generateRandomString(length: number) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    private generateFCMLikeToken() {
        const part1 = this.generateRandomString(10);
        const part2 = this.generateRandomString(7);
        const part3 = this.generateRandomString(150);

        return `${part1}:${part2}:${part3}`;
    }

    async addOrder(accountId: string, orderNumber: string): Promise<Order> {
        return await this.accountRep.addOrderNumber(accountId, orderNumber);
    }

    async setAccountCity(accountId: string, cityId: string) {
        return await this.accountRep.setCityToAccount(accountId, cityId);
    }

    async openForceRefresh(accountId: string) {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        await this.refreshForValidation(accountWithProxyEntity);
    }

    private async getHttpOptions(url: string, accountWithProxy: AccountWithProxyEntity): Promise<any> {
        const headers = this.sportmasterHeaders.getHeadersMobile(url, accountWithProxy);
        const httpsAgent = new SocksProxyAgent(accountWithProxy.proxy!.proxy);

        return { headers, httpsAgent };
    }

    private async getHttpOptionsSiteUserGate(accountWithProxy: AccountWithProxyEntity): Promise<any> {
        const headers = this.sportmasterHeaders.getHeadersUserGate(accountWithProxy.userGateToken!);
        const httpsAgent = new SocksProxyAgent(accountWithProxy.proxy!.proxy);

        return { headers, httpsAgent };
    }

    private async getHttpOptionsSiteCourse(accountWithProxy: AccountWithProxyEntity, accessTokenCourse: string): Promise<any> {
        const headers = this.sportmasterHeaders.getHeadersWithAccessToken(accessTokenCourse);
        const httpsAgent = new SocksProxyAgent(accountWithProxy.proxy!.proxy);

        return { headers, httpsAgent };
    }

    private async getHttpOptionsSiteCourseVideo(
        accessTokenCourse: string,
        proxy: string,
        videoId: string,
        lessonId: string,
        mnemocode: string,
    ): Promise<any> {
        const headers = this.sportmasterHeaders.getHeadersWithAccessToken(accessTokenCourse, videoId, lessonId, mnemocode);
        const httpsAgent = new SocksProxyAgent(proxy);

        return { headers, httpsAgent };
    }

    private async refreshPrivate(accountWithProxy: AccountWithProxyEntity) {
        const tokens = await this.refreshForValidation(accountWithProxy);
        const refreshTokensEntity = await this.updateTokensAccountPrivate(accountWithProxy.accountId, tokens);
        accountWithProxy.accessToken = refreshTokensEntity.accessToken;
        accountWithProxy.refreshToken = refreshTokensEntity.refreshToken;
        accountWithProxy.expiresInAccess = refreshTokensEntity.expiresInAccess;
        return refreshTokensEntity;
    }

    private async refreshForValidation(accountWithProxyEntity: AccountWithProxyEntity): Promise<IRefreshAccount> {
        const url = this.url + 'v1/auth/refresh';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            refreshToken: accountWithProxyEntity.refreshToken,
            deviceId: accountWithProxyEntity.deviceId,
        };

        const response = await this.httpService.post(url, payload, httpOptions);

        const accessToken = response.data.data.token.accessToken;
        const refreshToken = response.data.data.token.refreshToken;
        const expiresIn = response.data.data.token.expiresIn;

        return {
            accessToken,
            refreshToken,
            expiresIn,
        };
    }

    private async validationToken(accountWithProxy: AccountWithProxyEntity) {
        const isUpdate = accountWithProxy.updateTokensByTime();
        if (isUpdate) {
            await this.refreshPrivate(accountWithProxy);
        }
    }

    private async getAndValidateOrSetProxyAccount(accountWithProxy: IAccountWithProxy): Promise<AccountWithProxyEntity> {
        const currentTime = new Date();
        const timeBlockedAgo = new Date();
        timeBlockedAgo.setMinutes(currentTime.getMinutes() - +this.durationTimeProxyBlock);

        let accountWithProxyEntity: AccountWithProxyEntity;
        if (
            !accountWithProxy.proxy ||
            accountWithProxy.proxy.expiresAt < currentTime ||
            (accountWithProxy.proxy.blockedAt && accountWithProxy.proxy.blockedAt > timeBlockedAgo)
        ) {
            const proxy = await this.proxyService.getRandomProxy();
            const newAccountWithProxy = await this.accountRep.setProxyAccount(accountWithProxy.accountId, proxy.uuid);
            accountWithProxyEntity = new AccountWithProxyEntity(newAccountWithProxy);
        } else {
            accountWithProxyEntity = new AccountWithProxyEntity(accountWithProxy);
        }
        return accountWithProxyEntity;
    }

    private async getAccountEntity(accountId: string): Promise<AccountWithProxyEntity> {
        const accountWithProxy = await this.accountRep.getAccountWithProxy(accountId);

        if (!accountWithProxy) throw new NotFoundException(ERROR_ACCOUNT_NOT_FOUND);
        if (!accountWithProxy.isAccessMp) throw new HttpException(ERROR_LOGOUT_MP, HttpStatus.FORBIDDEN);
        const accountWithProxyEntity = await this.getAndValidateOrSetProxyAccount(accountWithProxy);
        await this.validationToken(accountWithProxyEntity);

        return accountWithProxyEntity;
    }

    async shortInfo(accountId: string): Promise<ShortInfoInterface> {
        const { bonusCount, qrCode, bonusDetails, citySMName } = await this.shortInfoPrivate(accountId);
        await this.updateAccountBonusCountPrivate(accountId, bonusCount);
        return { bonusCount, qrCode, bonusDetails, citySMName };
    }

    private async shortInfoPrivate(accountId: string): Promise<ShortInfoInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v2/bonus/shortInfo';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);

        const bonusCount: number = +response.data.data.info.totalAmount;
        const qrCode: string = response.data.data.info.clubCard.qrCode;
        const bonusDetails = response.data.data.info.details;
        return { bonusCount, qrCode, bonusDetails, citySMName: accountWithProxyEntity.citySM.name };
    }

    async sendSmsWithAnalytics(accountId: string, phoneNumber: string): Promise<string> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        await this.analyticsTags(accountWithProxyEntity);
        await new Promise<void>(resolve => {
            setTimeout(() => {
                resolve();
            }, 1000);
        });
        return await this.sendSms(accountWithProxyEntity, phoneNumber);
    }

    async sendSms(accountWithProxyEntity: string | AccountWithProxyEntity, phoneNumber: string): Promise<string> {
        if (typeof accountWithProxyEntity == 'string') {
            accountWithProxyEntity = await this.getAccountEntity(accountWithProxyEntity);
        }
        const url = this.url + `v1/verify/sendSms`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            phone: {
                countryCode: 7,
                nationalNumber: phoneNumber,
                isoCode: 'RU',
            },
            operation: 'change_phone',
            communicationChannel: 'SMS',
        };
        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data.data.requestId;
    }

    async phoneChange(accountId: string, requestId: string, code: string) {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const token = await this.verifyCheck(accountWithProxyEntity, requestId, code);
        await this.changePhone(accountWithProxyEntity, token);
    }

    private async verifyCheck(accountWithProxyEntity: AccountWithProxyEntity, requestId: string, code: string): Promise<string> {
        const url = this.url + `v1/verify/check`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            requestId,
            code,
        };

        const response = await this.httpService.post(url, payload, httpOptions);
        return response.data.data.token;
    }

    private async changePhone(accountWithProxyEntity: AccountWithProxyEntity, token: string): Promise<boolean> {
        const url = this.url + `v1/profile/changePhone`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            token,
        };
        await this.httpService.post(url, payload, httpOptions);
        return true;
    }

    async analyticsTags(accountWithProxyEntity: string | AccountWithProxyEntity): Promise<boolean> {
        if (typeof accountWithProxyEntity == 'string') {
            accountWithProxyEntity = await this.getAccountEntity(accountWithProxyEntity);
        }
        const url = this.url + `v2/analytics/tags`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {};
        await this.httpService.post(url, payload, httpOptions);

        return true;
    }

    async findCity(accountId: string, city: string) {
        const findCities = await this.findCityPrivate(accountId, city);

        const cityEntities = findCities.map(city => new CitySMEntity(city));
        await Promise.allSettled(cityEntities.map(cityEntity => this.accountRep.addingCitySM(cityEntity)));
        return cityEntities;
    }

    private async findCityPrivate(accountId: string, city: string): Promise<IFindCitiesAccount[]> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const encodedCity = encodeURI(city.toUpperCase());
        const url = this.url + `v1/city?query=${encodedCity}`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data.data.list;
    }

    async getCart(accountWithProxyEntity: string | AccountWithProxyEntity): Promise<CartInterface> {
        if (typeof accountWithProxyEntity == 'string') {
            accountWithProxyEntity = await this.getAccountEntity(accountWithProxyEntity);
        }
        const url = this.url + 'v1/cart2';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const payload = { clearDeletedLines: 'true', cartResponse: 'FULL2' };
        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data;
    }

    async applySnapshot(accountId: string, snapshotUrl: string): Promise<CartInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v1/cart/applySnapshot';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const payload = {
            snapshotUrl: snapshotUrl,
        };
        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data;
    }

    async addPromocode(accountId: string, promocode: string): Promise<boolean> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v1/cart2/promoCode';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const payload = {
            promoCode: promocode,
        };
        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data;
    }

    async createSnapshot(accountId: string): Promise<string> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v1/cart/createSnapshot';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const payload = {};
        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data.data.snapshotUrl;
    }

    async deletePromocode(accountId: string): Promise<void> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + this.url + 'v1/cart/promoCode';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        await this.httpService.delete(url, httpOptions);
    }

    async removeAllCart(accountId: string) {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const cart = await this.getCart(accountWithProxyEntity);
        const mainFromCart = selectMainFromCart(cart);
        for (const item of mainFromCart) {
            const arr = [];
            arr.push(item);
            await this.removeFromCart(accountWithProxyEntity, arr);
        }
    }

    async removeFromCart(accountWithProxyEntity: string | AccountWithProxyEntity, removeList: IItemsCart[]): Promise<any> {
        if (typeof accountWithProxyEntity == 'string') {
            accountWithProxyEntity = await this.getAccountEntity(accountWithProxyEntity);
        }
        const url = this.url + 'v1/cart2/remove';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const ids = removeList.map((item: IItemsCart) => {
            return {
                productId: item.productId,
                sku: item.sku,
                linesIds: removeList[0].linesIds,
            };
        });

        const payload = {
            ids: ids,
            cartFormat: 'FULL2',
        };
        await this.httpService.post(url, payload, httpOptions);
    }

    async addInCart(accountId: string, { productId, sku }: IItemsCart): Promise<any> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v1/cart2/add';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const payload = {
            productList: [
                {
                    id: {
                        productId,
                        sku,
                    },
                    quantity: 1,
                },
            ],
            cartFormat: 'LITE',
        };
        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data;
    }

    async searchProduct(accountId: string, article: string): Promise<SearchProductInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v2/products/search?limit=10&offset=0';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = { queryText: article, persGateTags: ['A_search', 'auth_login_call'] };

        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data;
    }

    async internalPickupAvailability(accountId: string, internalPickupAvabilityItems: IItemsCart[]): Promise<PickupAvabilityInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v1/cart2/internalPickupAvailability';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            cartItemIds: internalPickupAvabilityItems,
        };
        const response = await this.httpService.post(url, payload, httpOptions);
        return response.data;
    }

    async internalPickup(accountId: string, shopId: string, internalPickupAvabilityItems: IItemsCart[]) {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v1/cart2/obtainPoint/internalPickup';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            shopNumber: shopId,
            cartItemsByOrders: [{ cartItemIds: internalPickupAvabilityItems }],
        };

        const response = await this.httpService.post(url, payload, httpOptions);
        const data = response.data.data.cart.obtainPoints[0];
        const potentialOrder = data.potentialOrder.id;
        const version = response.data.data.cart.version;

        return { potentialOrder, version };
    }

    async submitOrder(accountId: string, version: string): Promise<string> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v1/cart/submit';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            cartVersion: version,
        };

        const response = await this.httpService.post(url, payload, httpOptions);

        const orderNumber = response.data.data.orders[0];
        return orderNumber.orderNumber;
    }

    async approveRecipientOrder(accountId: string, recipient: IRecipientOrder): Promise<any> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/cart2/receiver`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            fio: `${recipient.firstName} ${recipient.lastName}`,
            phone: { countryCode: 7, nationalNumber: `${recipient.number}`, isoCode: 'RU' },
            email: `${recipient.email}`,
        };

        const response = await this.httpService.post(url, payload, httpOptions);
        return response.data.data.cart.version;
    }

    async orderHistory(accountId: string) {
        const data = await this.orderHistoryPrivate(accountId);
        for (const order of data.data.orders) {
            try {
                await this.addOrder(accountId, order.number);
            } catch (err) {}
        }
        return data;
    }

    private async orderHistoryPrivate(accountId: string): Promise<OrdersInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v3/orderHistory`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data;
    }

    async orderInfo(accountId: string, orderNumber: string): Promise<OrderInfoInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v4/order/${orderNumber}`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const payload = {};
        const response = await this.httpService.post(url, payload, httpOptions);
        return response.data;
    }

    async cancellOrder(accountId: string, orderNumber: string): Promise<NonNullable<unknown>> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const reasons = [103, 104, 105, 106];
        const randomIndex = Math.floor(Math.random() * reasons.length);
        const reason = reasons[randomIndex];
        const url = this.url + `v1/order/${orderNumber}`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            cancelReasonId: reason,
        };

        const response = await this.httpService.post(url, payload, httpOptions);
        return response.data;
    }

    async getPromocodeFromProfile(accountId: string): Promise<PromocodeInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/promo`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data;
    }

    async getProfile(accountId: string): Promise<PromocodeInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/profile`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data;
    }

    async pushToken(accountId: string, pushToken: string): Promise<any> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v1/profile/pushToken';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            pushToken,
            pushService: 'fcm',
        };

        const response = await this.httpService.post(url, payload, httpOptions);
        return response.data;
    }

    private async getUserGateToken(accountWithProxyEntity: AccountWithProxyEntity): Promise<UserGateTokenInterface> {
        const url = this.url + `v1/profile/userGateToken`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data;
    }

    async getCoursesHtml(accountWithProxyEntity: AccountWithProxyEntity): Promise<string> {
        const url = this.urlSite + `courses/?webview=true`;
        const httpOptions = await this.getHttpOptionsSiteUserGate(accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data;
    }

    private getAccessTokenCourseFromResponse(html: string): string {
        const regex = /(?<=},token:")[\w\W]*?(?=")/;
        const match = html.match(regex);
        if (match) {
            return match[0];
        }
        throw new HttpException(ERROR_GET_ACCESS_TOKEN_COURSE, HttpStatus.BAD_REQUEST);
    }

    private async getCourses(accessTokenCourse: string, accountWithProxyEntity: AccountWithProxyEntity): Promise<CourseList> {
        const url = this.urlSite + `courses/api/courses?limit=10`;
        const httpOptions = await this.getHttpOptionsSiteCourse(accountWithProxyEntity, accessTokenCourse);
        const response = await this.httpService.get(url, httpOptions);
        return response.data;
    }

    async promblemCourses(accountId: string): Promise<void> {
        await this.accountRep.promblemCourses(accountId);
    }

    async getActiveCourseAccount(): Promise<string[]> {
        return await this.accountRep.getActiveCourseAccount();
    }

    async watchingLesson(lesson: IWatchLesson, accountId: string): Promise<boolean> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);

        const status = await this.privateWatchingLesson(lesson, accountWithProxyEntity);
        return status == 204;
    }

    private async privateWatchingLesson(
        { mnemocode, videoId, lessonId, duration }: IWatchLesson,
        accountWithProxyEntity: AccountWithProxyEntity,
    ): Promise<number> {
        if (!accountWithProxyEntity.accessTokenCourse) {
            await this.promblemCourses(accountWithProxyEntity.accountId);
            throw new HttpException(ERROR_ACCESS_TOKEN_COURSE, HttpStatus.FORBIDDEN);
        }

        const url = this.urlSite + `courses/api/courses/lessons/${mnemocode}/${lessonId}/watching`;
        const httpOptions = await this.getHttpOptionsSiteCourseVideo(
            accountWithProxyEntity.accessTokenCourse,
            accountWithProxyEntity.proxy!.proxy,
            videoId,
            lessonId,
            mnemocode,
        );
        const payload = {
            startTime: 0,
            endTime: duration,
        };
        try {
            const response = await this.httpService.post(url, payload, httpOptions);
            return response.status;
        } catch (e: any) {
            return 404;
        }
    }
}
