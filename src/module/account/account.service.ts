import { HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AccountRepository } from './account.repository';
import { AddingAccountRequestDto } from './dto/create-account.dto';
import { AccountEntity } from './entities/account.entity';
import {
    AccountWDevice,
    AddressSuggestList,
    IAccountWithProxy,
    IRecipientOrder,
    IRefreshAccount,
    ResolvedCity,
} from './interfaces/account.interface';
import { CitySM, CourseStatus, LessonStatus, Order } from '@prisma/client';
import { ProxyService } from '../proxy/proxy.service';
import {
    ERROR_ACCESS_TOKEN_COURSE,
    ERROR_ACCOUNT_NOT_FOUND,
    ERROR_COURSE_NOT_FOUND,
    ERROR_GET_ACCESS_TOKEN_COURSE,
    ERROR_PROGRESS_ID,
} from './constants/error.constant';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../http/http.service';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { AccountWithProxyEntity } from './entities/accountWithProxy.entity';
import { CartInterface } from './interfaces/cart.interface';
import { IItemsCart, selectMainFromCart } from '../telegram/utils/cart.utils';
import { SearchProductInterface } from './interfaces/search-product.interface';
import { PickupAvabilityInterface } from './interfaces/pickup-avability.interface';
import { OrdersInterface } from './interfaces/orders.interface';
import { OrderInfoInterface } from './interfaces/order-info.interface';
import { ShorInfo, ShorInfoData, ShortInfoInterface } from './interfaces/short-info.interface';
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
import { TlsProxyService } from '../http/tls-forwarder.service';
import { GetAccountCredentialsResponseDto, UpdateAccountCredentialsRequestDto } from './dto/account-credentials.dto';
import { DataProfile } from './interfaces/profile.interface';
import { DataAddress, DataCoord, GeoPointLng, Location } from './interfaces/geo.interface';
import { CitySMEntity } from './entities/citySM.entity';
import { encodeXlocation } from './utils/x-location.utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { RetryOn401 } from './decorators/retry-on-403.decorator';
import { PersonalDiscount, PersonalDiscountResponse } from './interfaces/personal-discount.interface';
import { ProfileFamilyResponse } from './interfaces/profile-family.interface';
import { FamilyInviteResponse, InviteMemberFamily, MemberFamily } from './interfaces/family-invite.interface';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { CheckProductResultItem, ProductApiResponse } from './interfaces/product.interface';
import { SetPersonalDiscountAccountRequestDto } from './dto/set-personal-discount.dto';
import { AccountDiscountRepository } from './account-discount.repository';
import { parseDateFlexible } from './utils/parse-data';
import { NodePair, UpsertPersonalDiscountProductsInput } from './interfaces/account-discount.interface';
import { AccountTelegramParamsDto } from './dto/account-telegram-ids.dto';
import { keyDiscountAccount, keyDiscountNodes } from './cache-key/key';
import { CheckProductBatchRequestDto, PrepareProductCheckRequestDto } from './dto/check-product.prepare.dto';
import { CalculateService } from '../calculate/calculate.service';
import { Cookie } from './interfaces/cookie.interface';
import { OrderRepository } from './order.repository';
import { PreparedAccountInfo } from './interfaces/extend-chrome.interface';
import { Products } from './interfaces/products.interface';
import { chunk, requestWithBackoff, startOfNextDayUTC } from './utils/set-products.utils';
import { DelayedPublisher } from '@common/broker/delayed.publisher';
import { RABBIT_MQ_QUEUES } from '@common/broker/rabbitmq.queues';

@Injectable()
export class AccountService {
    private readonly logger = new Logger(AccountService.name);
    private url = this.configService.getOrThrow('API_DONOR');
    private urlSite = this.configService.getOrThrow('API_DONOR_SITE');
    private adminsId: string[] = this.configService.getOrThrow('TELEGRAM_ADMIN_ID').split(',');
    private durationTimeProxyBlock = this.configService.getOrThrow('TIME_DURATION_PROXY_BLOCK_IN_MIN');

    private TTL_CASH_ACCOUNT = 20_000;
    private TTL_CASH_DISCOUNT = 10_800_000;
    private readonly MAX_CONCURRENCY = 5;
    private readonly PAGE_SIZE = 100;
    private readonly DB_CHUNK = 800;
    private readonly PERSONAL_DISCOUNT_BATCH_SIZE = 5;
    private readonly PERSONAL_DISCOUNT_RATE_SECONDS = 80;

    constructor(
        private configService: ConfigService,
        private accountRep: AccountRepository,
        private accountDiscountRepo: AccountDiscountRepository,
        private orderRepository: OrderRepository,
        private proxyService: ProxyService,
        private readonly tlsForwarder: TlsProxyService,
        private httpService: HttpService,
        private courseService: CourseService,
        private deviceInfoService: DeviceInfoService,
        private sportmasterHeaders: SportmasterHeadersService,
        private calculateService: CalculateService,
        private readonly publisher: DelayedPublisher,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
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

    async changeOwner(accountId: string, ownerTelegramId: string): Promise<void> {
        await this.accountRep.updateOwner(accountId, ownerTelegramId);
        this.logger.log(`owner changed: account=${accountId} -> ${ownerTelegramId}`);
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
        const isExist = await this.checkOnExistProgressLesson(accountId);

        if (!isExist) {
            const lessons = await this.courseService.getAllLesson();
            await this.courseService.createAccountLessonProgressFromExistCourses(accountId, lessons);
        }
        return coursesInAccount;
    }

    async checkOnExistProgressLesson(accountId: string) {
        const lessonsProgress = await this.courseService.getLessonsProgressByAccountId(accountId);
        return lessonsProgress.length != 0;
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

    async updateStatusAccountCourseBulk(accountIds: string[], status: CourseStatus): Promise<number> {
        return this.accountRep.updateStatusAccountCourseBulk(accountIds, status);
    }

    async updateStatusAccountCourse(accountId: string, statusCourse: CourseStatus) {
        return await this.accountRep.updateStatusAccountCourse(accountId, statusCourse);
    }

    async getAccountsCourseByStatus(statusCourse: CourseStatus) {
        const accounts = await this.accountRep.getAccountsCourseByStatus(statusCourse);
        return accounts.map(acc => acc.accountId);
    }

    async getRefreshExpirationDates(accountIds: string[]) {
        const accounts = await this.accountRep.getAccountsCredentials(accountIds);

        return accounts.map(acc => ({
            accountId: acc.accountId,
            expiresInRefresh: acc.expiresInRefresh ? format(new Date(acc.expiresInRefresh), 'dd.MM.yyyy', { locale: ru }) : null,
        }));
    }

    async connectionCourseAccount(accountId: string) {
        const account = await this.getAccount(accountId);

        const lessons = await this.courseService.getAllLesson();
        try {
            await this.accountRep.addAccountCourses(accountId);
            await this.courseService.createAccountLessonProgress(account.accountId, lessons);
        } catch (e) {
            await this.courseService.createAccountLessonProgressFromExistCourses(account.accountId, lessons);
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

    async addOrder(accountId: string, orderNumber: string, date: Date = new Date()): Promise<Order> {
        return this.accountRep.addOrderNumber(accountId, orderNumber, date);
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

    private async getHttpOptionsRefresh(url: string, accountWithProxy: AccountWithProxyEntity): Promise<any> {
        const headers = this.sportmasterHeaders.getHeadersRefreshMobile(url, accountWithProxy);
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

    //Используется в декораторе 403
    async swapAccessToken(accountWithProxy: AccountWithProxyEntity) {
        const raw = accountWithProxy.cookie as unknown;
        let cookies: Cookie[];

        try {
            if (typeof raw === 'string') {
                cookies = JSON.parse(raw);
            } else if (Array.isArray(raw)) {
                cookies = raw as Cookie[];
            } else if (raw && typeof raw === 'object') {
                // На случай, если поле — JSON (Prisma JSONB)
                // и там лежит массив, но тип пришёл как object
                cookies = Array.isArray(raw as any) ? (raw as any) : Object.values(raw as any);
            } else {
                throw new Error('cookie field is empty');
            }
        } catch (e) {
            throw new Error(`Failed to parse cookies for ${accountWithProxy.accountId}: ${(e as Error).message}`);
        }

        if (!Array.isArray(cookies) || cookies.length === 0) {
            throw new Error(`Cookies are empty for ${accountWithProxy.accountId}`);
        }

        const isSmid = (c: Cookie) => (c.name || '').toLowerCase() === 'smid';

        const smid = cookies.find(c => isSmid(c) && c.domain === 'www.sportmaster.ru') ?? cookies.find(c => isSmid(c));

        if (!smid) {
            throw new Error(`Not Found SMID for ${accountWithProxy.accountId}`);
        }

        const token = (smid.value || '').trim();
        if (!token) {
            throw new Error(`SMID has empty value for ${accountWithProxy.accountId}`);
        }

        await this.accountRep.updateCredentials(accountWithProxy.accountId, { accessToken: token });
    }

    private async refreshPrivate(accountWithProxy: AccountWithProxyEntity) {
        const tokens = await this.refreshForValidation(accountWithProxy);
        const refreshTokensEntity = await this.updateTokensAccountPrivate(accountWithProxy.accountId, tokens);
        accountWithProxy.accessToken = refreshTokensEntity.accessToken;
        accountWithProxy.refreshToken = refreshTokensEntity.refreshToken;
        accountWithProxy.expiresInAccess = refreshTokensEntity.expiresInAccess;
        return refreshTokensEntity;
    }

    async getAccountCredentials(accountId: string): Promise<GetAccountCredentialsResponseDto> {
        const acc = await this.accountRep.getCredentials(accountId);
        if (!acc) throw new NotFoundException(ERROR_ACCOUNT_NOT_FOUND);
        return acc;
    }

    async updateAccountCredentials(accountId: string, dto: UpdateAccountCredentialsRequestDto) {
        return this.accountRep.updateCredentials(accountId, dto);
    }

    private async refreshForValidation(accountWithProxyEntity: AccountWithProxyEntity): Promise<IRefreshAccount> {
        const url = this.url + 'v1/auth/refresh';
        const httpOptions = await this.getHttpOptionsRefresh(url, accountWithProxyEntity);

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

    private async rawLoadAccountCore(accountId: string): Promise<AccountWithProxyEntity> {
        const accountWithProxy = await this.accountRep.getAccountWithProxy(accountId);
        if (!accountWithProxy) throw new NotFoundException(ERROR_ACCOUNT_NOT_FOUND);

        await this.cacheManager.del(accountId);
        return this.getAndValidateOrSetProxyAccount(accountWithProxy);
    }

    private async loadAccountCore(accountId: string): Promise<AccountWithProxyEntity> {
        const accountWithProxy = await this.accountRep.getAccountWithProxy(accountId);

        if (!accountWithProxy) throw new NotFoundException(ERROR_ACCOUNT_NOT_FOUND);

        const entity = await this.getAndValidateOrSetProxyAccount(accountWithProxy);
        await this.validationToken(entity);
        return entity;
    }

    private async getAccountEntity(accountId: string): Promise<AccountWithProxyEntity> {
        const accountEntityFromCache = await this.cacheManager.get<AccountWithProxyEntity>(accountId);
        if (!accountEntityFromCache) {
            const account = await this.loadAccountCore(accountId);
            await this.cacheManager.set(accountId, account, this.TTL_CASH_ACCOUNT);
            return account;
        }
        return accountEntityFromCache;
    }

    private async resolveCityByUri(accountId: string, uri: string): Promise<ResolvedCity> {
        const account = await this.getAccountEntity(accountId);

        const address = await this.getAddressByUri(account, uri);
        const { lat, lon } = address.location.geoPoint;
        const infoCity = await this.findCityByCoord(account, { lat, lng: lon });

        const city = await this.ensureCityRecord(infoCity, address.location);

        return { account, city, location: address.location };
    }

    private async ensureCityRecord(
        infoCity: { city: { id: string; name: string }; location: { locationName: string } },
        location: Location,
    ): Promise<CitySM> {
        const existing = await this.findCityBD(infoCity.city.id);

        if (!existing) {
            const entity = new CitySMEntity({
                cityId: infoCity.city.id,
                name: infoCity.city.name,
                fullName: infoCity.location.locationName,
                xLocation: encodeXlocation(location),
            });
            return this.addingCityBD(entity);
        }

        return existing;
    }

    async getCity(accountId: string, uri: string) {
        const { city } = await this.resolveCityByUri(accountId, uri);
        return city;
    }

    async setAccountCity(accountId: string, uri: string) {
        const { account, city, location } = await this.resolveCityByUri(accountId, uri);
        await this.setGeo(account, location);

        if (account.cityId !== city.cityId) {
            await this.setCityToAccount(accountId, city.cityId);
            await this.cacheManager.del(accountId);
        }

        return city;
    }

    async setCityToAccount(accountId: string, cityId: string) {
        await this.accountRep.setCityToAccount(accountId, cityId);
    }

    async pickProxyForAccount(accountId: string): Promise<string> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        return accountWithProxyEntity.proxy!.proxy;
    }

    async *paginateProducts(
        proxyId: string,
        accountId: string,
        nodeUrl: string,
        pageSize = 100,
        maxPagesCap = 20,
        findProductsBySearch: (accountId: string, url: string, limit: number, offset: number) => Promise<Products>,
    ) {
        let offset = 0;
        let total: number | null = null;
        let pages = 0;

        while (pages < maxPagesCap) {
            const res = await requestWithBackoff(proxyId, () => findProductsBySearch(accountId, nodeUrl, pageSize, offset));
            const items = res.list ?? [];
            pages++;

            // Если total ещё неизвестен и meta пришла — зафиксируем total один раз
            if (total === null && res.meta?.count != null) {
                total = res.meta.count;
                if (total <= 0) break;
            }

            // Пустая страница — стоп
            if (items.length === 0) break;

            // Отдаём текущие элементы
            yield items;

            // Если знаем общий total — контролируем окончание по нему
            if (total !== null) {
                offset += pageSize; // классический limit/offset
                if (offset >= total) break; // всё прочитали
            } else {
                // total неизвестен: ориентируемся по «неполной» странице
                if (items.length < pageSize) break; // последняя страница
                offset += pageSize;
            }
        }
    }

    async queueAccountsForPersonalDiscountV1(data: SetPersonalDiscountAccountRequestDto): Promise<{
        ok: boolean;
        estimatedSeconds: number;
    }> {
        const normalized = data.personalDiscounts.map(id => id.trim()).filter(Boolean);
        const uniqueAccountIds = Array.from(new Set(normalized));

        if (!uniqueAccountIds.length) {
            throw new HttpException('No valid accounts provided', HttpStatus.BAD_REQUEST);
        }

        const batches = Array.from(chunk(uniqueAccountIds, this.PERSONAL_DISCOUNT_BATCH_SIZE));

        await Promise.all(
            batches.map(batch =>
                this.publisher.publish(
                    RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_QUEUE,
                    {
                        telegramId: data.telegramId,
                        personalDiscounts: batch,
                    },
                    0,
                ),
            ),
        );

        const estimatedSeconds = batches.length * this.PERSONAL_DISCOUNT_RATE_SECONDS;

        this.logger.log(
            `Queued ${uniqueAccountIds.length} accounts for personal discount (telegramId=${data.telegramId}, batches=${batches.length})`,
        );

        return {
            ok: true,
            estimatedSeconds,
        };
    }

    async setAccountsForPersonalDiscountV1(data: SetPersonalDiscountAccountRequestDto): Promise<{
        ok: boolean;
        results: Array<{ accountId: string; saved: number }>;
        errors: Array<{ accountId: string; message: string }>;
    }> {
        const { telegramId, personalDiscounts } = data;
        const results: Array<{ accountId: string; saved: number }> = [];
        const errors: Array<{ accountId: string; message: string }> = [];

        const worker = async (accountId: string) => {
            const proxyId = await this.pickProxyForAccount(accountId);

            const pd = await this.personalDiscount(accountId);
            const urlNodes = (pd?.list ?? []).map(n => ({
                url: n.url,
                dateEnd: startOfNextDayUTC(n.dateEnd),
            }));

            let savedTotal = 0;

            for (const node of urlNodes) {
                const buffer: UpsertPersonalDiscountProductsInput[] = [];

                for await (const page of this.paginateProducts(
                    proxyId,
                    accountId,
                    node.url,
                    this.PAGE_SIZE,
                    20,
                    this.findProductsBySearch.bind(this),
                )) {
                    for (const it of page) {
                        buffer.push({
                            productId: String(it.id),
                            telegramId: String(telegramId),
                            accountId,
                            dateEnd: node.dateEnd,
                        });
                    }

                    // периодически пишем в БД, чтобы не раздувать память
                    if (buffer.length >= this.DB_CHUNK) {
                        const unique = Array.from(new Map(buffer.map(x => [`${x.productId}|${x.telegramId}|${x.accountId}`, x])).values());
                        for (const part of chunk(unique, this.DB_CHUNK)) {
                            await this.accountDiscountRepo.upsertManyDiscountProducts(part);
                            savedTotal += part.length;
                        }
                        buffer.length = 0;
                    }
                }

                if (buffer.length) {
                    const unique = Array.from(new Map(buffer.map(x => [`${x.productId}|${x.telegramId}|${x.accountId}`, x])).values());
                    for (const part of chunk(unique, this.DB_CHUNK)) {
                        await this.accountDiscountRepo.upsertManyDiscountProducts(part);
                        savedTotal += part.length;
                    }
                }
            }

            return { accountId, saved: savedTotal };
        };

        // глобальный параллелизм: по 5 аккаунтов
        for (let i = 0; i < personalDiscounts.length; i += this.MAX_CONCURRENCY) {
            const slice = personalDiscounts.slice(i, i + this.MAX_CONCURRENCY);
            const settled = await Promise.allSettled(slice.map(a => worker(a)));

            settled.forEach((r, idx) => {
                const accountId = slice[idx];
                if (r.status === 'fulfilled') {
                    results.push({ accountId, saved: r.value.saved });
                } else {
                    errors.push({ accountId, message: r.reason?.message ?? 'Unknown error' });
                }
            });
        }

        return { ok: errors.length === 0, results, errors };
    }

    async setAccountsForPersonalDiscount(data: SetPersonalDiscountAccountRequestDto): Promise<{
        ok: boolean;
        results: Array<{ accountId: string; saved: number }>;
        errors: Array<{ accountId: string; message: string }>;
    }> {
        const { telegramId, personalDiscounts } = data;

        const keyNodes = keyDiscountNodes(telegramId);
        const keyAccounts = keyDiscountAccount(telegramId);

        await Promise.allSettled([this.cacheManager.del(keyNodes), this.cacheManager.del(keyAccounts)]);

        const results: Array<{ accountId: string; saved: number }> = [];
        const errors: Array<{ accountId: string; message: string }> = [];

        // воркер для одного accountId
        const worker = async (accountId: string) => {
            const pd = await this.personalDiscount(accountId);

            const items =
                pd?.list?.map(l => {
                    const raw = l?.dateEnd ?? '';
                    const parsed = parseDateFlexible(raw);

                    return {
                        nodeId: l?.base?.nodeId ?? '',
                        nodeName: l?.nodeName ?? '',
                        dateEnd: parsed,
                    };
                }) ?? [];

            const valid = items.filter(x => x.nodeId && x.nodeName && !isNaN(x.dateEnd.getTime()));

            if (valid.length) {
                await this.accountDiscountRepo.upsertMany(accountId, telegramId, valid);
            }

            return { accountId, saved: valid.length };
        };

        for (let i = 0; i < personalDiscounts.length; i += this.MAX_CONCURRENCY) {
            const slice = personalDiscounts.slice(i, i + this.MAX_CONCURRENCY);
            const settled = await Promise.allSettled(slice.map(a => worker(a)));

            settled.forEach((r, idx) => {
                const accountId = slice[idx];
                if (r.status === 'fulfilled') {
                    results.push({ accountId, saved: r.value.saved });
                } else {
                    errors.push({
                        accountId,
                        message: r.reason?.message ?? 'Unknown error',
                    });
                }
            });
        }

        return { ok: errors.length === 0, results, errors };
    }

    private computeCalculateProductFromProduct(
        p: ProductApiResponse['product'],
        isInventory: boolean,
    ): { price: number; bonus: number } | null {
        const catalog = Number(p?.price?.catalog?.value);
        const retail = Number(p?.price?.retail?.value);
        if (!isFinite(catalog) || !isFinite(retail) || catalog <= 0 || retail <= 0) {
            return null;
        }

        const basePrice = catalog / 100;
        const retailPrice = retail / 100;

        let discountShop = Math.floor((1 - retailPrice / basePrice) * 100);
        if (!isFinite(discountShop) || discountShop < 0) discountShop = 0;
        if (discountShop > 100) discountShop = 100;

        const promoPercent = 15;
        const priceAfterPromo =
            discountShop < 50
                ? this.calculateService.computePriceWithPromoWithoutBonus(basePrice, retailPrice, discountShop, isInventory, promoPercent)
                : retailPrice;

        const bonus = this.calculateService.computeBonus(basePrice, priceAfterPromo, discountShop, isInventory);

        const priceOnKassa = priceAfterPromo - bonus;

        return {
            price: Math.floor(priceOnKassa),
            bonus: Math.floor(bonus),
        };
    }

    async getDistinctNodePairsByTelegram(telegramId: string): Promise<{ nodes: NodePair[] }> {
        const key = keyDiscountNodes(telegramId);

        const nodesCache = await this.cacheManager.get<NodePair[]>(key);

        if (nodesCache) return { nodes: nodesCache };

        const nodes = await this.accountDiscountRepo.findDistinctNodePairsByTelegram(telegramId);

        await this.cacheManager.set(key, nodes, this.TTL_CASH_DISCOUNT);

        return { nodes };
    }

    async removeDiscountsByAccountId({ telegramId, accountId }: AccountTelegramParamsDto): Promise<{
        deleted: number;
    }> {
        const keyNodes = keyDiscountNodes(telegramId);
        const keyAccounts = keyDiscountAccount(telegramId);

        const [, , dbDelete] = await Promise.allSettled([
            this.cacheManager.del(keyNodes),
            this.cacheManager.del(keyAccounts),
            this.accountDiscountRepo.deleteByAccountAndTelegram(accountId, telegramId),
        ]);

        if (dbDelete.status === 'rejected') {
            throw dbDelete.reason ?? new Error('Failed to delete discounts');
        }

        return { deleted: dbDelete.value ?? 0 };
    }

    async getUserAccountIds(telegramId: string): Promise<{ accountIds: string[] }> {
        const key = keyDiscountAccount(telegramId);
        const accountsCache = await this.cacheManager.get<string[]>(key);

        if (accountsCache) return { accountIds: accountsCache };

        const accountIds = await this.accountDiscountRepo.findDistinctAccountIdsByTelegram(telegramId);
        await this.cacheManager.set(key, accountIds, this.TTL_CASH_DISCOUNT);

        return { accountIds };
    }

    private hasMyDiscountInDiscountList(p: ProductApiResponse['product']): boolean {
        const list = p?.personalPrice?.discountList ?? [];
        return list.some(x => x?.actionName?.toLowerCase() === 'моя скидка');
    }

    private mapBonuses(p: ProductApiResponse['product']): number {
        const list = p?.personalPrice?.discountList ?? [];
        const item = list.find(x => x?.actionName?.toLowerCase() === 'оплата бонусами');
        const raw = item?.summa?.value ?? 0;
        return Number(raw) / 100;
    }

    private mapPrice(p: ProductApiResponse['product']): number {
        const raw = p?.personalPrice?.price?.value ?? 0;
        return Number(raw) / 100;
    }

    private buildResult(
        product: ProductApiResponse['product'],
        accountId: string,
        bonusCount?: number,
        calculateProduct?: { price: number; bonus: number },
        ordersToday: number = 0,
    ): CheckProductResultItem | null {
        if (!this.hasMyDiscountInDiscountList(product)) return null;
        return {
            accountId,
            discountRate: product?.price?.discountRate ?? null,
            price: this.mapPrice(product),
            bonuses: this.mapBonuses(product),
            bonusCount,
            ordersToday,
            calculateProduct,
        };
    }

    // async prepareAccountsForProductCheck({ telegramId, nodeId }: PrepareProductCheckRequestDto): Promise<{ accountIds: string[] }> {
    //     const accountIds = await this.accountDiscountRepo.findAccountIdsByTelegramAndNodes(telegramId, nodeId);
    //     return { accountIds };
    // }

    async prepareAccountsForProductCheckV1({ telegramId, nodeId }: PrepareProductCheckRequestDto): Promise<{
        accounts: PreparedAccountInfo[];
    }> {
        // 1. аккаунты по телеграму и ноде
        const accountIds = await this.accountDiscountRepo.findAccountIdsByTelegramAndNodes(telegramId, nodeId);

        if (!accountIds?.length) {
            return { accounts: [] };
        }

        // 2. заказы за сегодня (map accountId -> count)
        const ordersTodayMap = await this.orderRepository.countTodayByAccountIds(accountIds);

        // 3. бонусы (map accountId -> bonusCount)
        const bonusMap = await this.accountRep.getBonusCountByAccountIds(accountIds);

        // 4. собрать итоговый список
        const accounts: PreparedAccountInfo[] = accountIds.map(accountId => ({
            accountId,
            bonus: bonusMap[accountId] ?? 0,
            ordersNumber: ordersTodayMap[accountId] ?? 0,
        }));

        return { accounts };
    }

    private getHttpStatus(err: any): number | undefined {
        return err?.response?.status ?? err?.response?.data?.statusCode;
    }

    private isBadRequest400(err: any): boolean {
        return this.getHttpStatus(err) === 400;
    }

    private isNotFound404(err: any): boolean {
        const status = this.getHttpStatus(err);
        const msg = err?.response?.data?.message ?? err?.message;
        return status === 404 || msg === 'PRODUCT_NOT_FOUND';
    }

    async checkProductBatchForPersonalDiscount({ telegramId, isInventory, productId, accountIds }: CheckProductBatchRequestDto): Promise<{
        ok: boolean;
        productId: string;
        processed: number;
        results: CheckProductResultItem[];
        errors: CheckProductResultItem[];
    }> {
        if (!accountIds?.length) {
            return { ok: true, productId, processed: 0, results: [], errors: [] };
        }

        const ordersTodayMap = await this.orderRepository.countTodayByAccountIds(accountIds);

        const results: CheckProductResultItem[] = [];
        const errors: CheckProductResultItem[] = [];

        const [probeId, ...restIds] = accountIds;

        try {
            const probeRes = await this.getProductById(probeId, productId);
            const product = probeRes?.product;
            if (!product?.id) {
                // защитный вариант: нет id продукта в 200-ответе — считаем локальной проблемой
                errors.push({ accountId: probeId, error: 'NO_PRODUCT' });
            } else {
                let bonusCount: number | undefined;
                if (this.hasMyDiscountInDiscountList(product)) {
                    try {
                        const short = await this.shortInfo(probeId);
                        bonusCount = short?.bonusCount;
                    } catch {
                        /* не критично */
                    }
                }
                const calc = this.computeCalculateProductFromProduct(product, isInventory);
                const mapped = this.buildResult(product, probeId, bonusCount, calc || undefined, ordersTodayMap[probeId] ?? 0);
                if (mapped) results.push(mapped);
            }
        } catch (e: any) {
            if (this.isNotFound404(e)) {
                // 404 на пробном — глобально для всех
                throw new NotFoundException('PRODUCT_NOT_FOUND');
            }
            // 400 на пробном — локальная ошибка этого аккаунта, остальные продолжаем
            const errorText = this.isBadRequest400(e)
                ? e?.response?.data?.message ?? 'BAD_REQUEST'
                : e?.response?.data?.message ?? e?.message ?? 'UNKNOWN_ERROR';
            errors.push({ accountId: probeId, error: errorText });
        }

        // --- ОСТАЛЬНЫЕ АККАУНТЫ ---
        const worker = async (accountId: string): Promise<void> => {
            try {
                const res = await this.getProductById(accountId, productId);
                const product = res?.product;
                if (!product?.id) {
                    errors.push({ accountId, error: 'NO_PRODUCT' });
                    return;
                }

                let bonusCount: number | undefined;
                if (this.hasMyDiscountInDiscountList(product)) {
                    try {
                        const short = await this.shortInfo(accountId);
                        bonusCount = short?.bonusCount;
                    } catch {
                        /* ignore */
                    }
                }

                const calc = this.computeCalculateProductFromProduct(product, isInventory);
                const mapped = this.buildResult(product, accountId, bonusCount, calc || undefined, ordersTodayMap[accountId] ?? 0);
                if (mapped) results.push(mapped);
            } catch (err: any) {
                // для остальных — любые 4xx/5xx считаем локальными
                const errorText = err?.response?.data?.message ?? err?.message ?? 'UNKNOWN_ERROR';
                errors.push({ accountId, error: errorText });
            }
        };

        for (let i = 0; i < restIds.length; i += this.MAX_CONCURRENCY) {
            const slice = restIds.slice(i, i + this.MAX_CONCURRENCY);
            await Promise.all(slice.map(id => worker(id)));
        }

        return {
            ok: true,
            productId,
            processed: accountIds.length,
            results,
            errors,
        };
    }

    @RetryOn401()
    async suggestCityByGeo(accountId: string, city: string): Promise<AddressSuggestList[]> {
        const acc = await this.getAccountEntity(accountId);
        const encodedCity = encodeURI(city.toUpperCase());
        const url = this.url + `v1/geo/suggest?query=${encodedCity}`;
        const httpOptions = await this.getHttpOptions(url, acc);
        const response = await this.httpService.get(url, httpOptions);
        return response.data.data.addressSuggestList;
    }

    @RetryOn401()
    private async getAddressByUri(account: AccountWithProxyEntity, uri: string): Promise<DataAddress> {
        const encodedQuery = encodeURIComponent(uri);
        const url = `${this.url}v1/geo/address?query=${encodedQuery}&mode=URI`;

        const httpOptions = await this.getHttpOptions(url, account);
        const response = await this.httpService.get(url, httpOptions);
        return response.data.data;
    }

    @RetryOn401()
    private async findCityByCoord(account: AccountWithProxyEntity, coord: GeoPointLng): Promise<DataCoord> {
        const url = this.url + `v1/city/coord?lat=${coord.lat}&lng=${coord.lng}`;
        const httpOptions = await this.getHttpOptions(url, account);
        const response = await this.httpService.get(url, httpOptions);
        return response.data.data;
    }

    @RetryOn401()
    private async setGeo(account: AccountWithProxyEntity, location: Location): Promise<void> {
        const url = this.url + `v1/geo/location`;
        const httpOptions = await this.getHttpOptions(url, account);

        const payload = {
            location,
        };

        await this.httpService.post(url, payload, httpOptions);
    }

    async addingCityBD(city: CitySMEntity) {
        return this.accountRep.addingCitySM(city);
    }

    async findCityBD(cityId: string) {
        return this.accountRep.findCitySM(cityId);
    }

    async shortInfo(accountId: string): Promise<ShortInfoInterface> {
        const { response, account } = await this.shortInfoPrivate(accountId);
        await this.updateAccountBonusCountPrivate(accountId, response.info.totalAmount);
        return {
            bonusCount: response.info.totalAmount,
            qrCode: response.info.clubCard.qrCode,
            bonusDetails: response.info.details,
            citySMName: account.citySM.name,
            bonusLevel: response.info.bonusLevel.code,
        };
    }

    @RetryOn401()
    private async shortInfoPrivate(accountId: string): Promise<{
        response: ShorInfo;
        account: AccountWithProxyEntity;
    }> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v2/bonus/shortInfo';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get<ShorInfoData>(url, httpOptions);

        return {
            response: response.data.data,
            account: accountWithProxyEntity,
        };
    }

    async sendSmsWithAnalytics(accountId: string, phoneNumber: string): Promise<string> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        await this.analyticsTags(accountWithProxyEntity);
        await new Promise<void>(resolve => setTimeout(resolve, 1000));

        return await this.sendSms(accountWithProxyEntity, phoneNumber);
    }

    @RetryOn401()
    async sendSms(accountOrId: string | AccountWithProxyEntity, phoneNumber: string): Promise<string> {
        const account = typeof accountOrId === 'string' ? await this.getAccountEntity(accountOrId) : accountOrId;

        const targetUrl = this.url + `v1/verify/sendSms`;

        const headers = this.sportmasterHeaders.getHeadersForSearchAccount(targetUrl, account);

        const payload = {
            phone: {
                countryCode: '7',
                nationalNumber: phoneNumber,
                isoCode: 'RU',
            },
            operation: 'change_phone',
            communicationChannel: 'SMS',
        };

        const responseData = await this.tlsForwarder.forwardRequest<{ data: { requestId: string } }>({
            requestUrl: targetUrl,
            requestMethod: 'POST',
            headers,
            requestBody: payload,
            proxyUrl: account.proxy!.proxy,
        });

        if (!responseData?.data?.requestId) {
            this.logger.error('Unexpected response from Sportmaster after TLS forwarding', responseData);
            throw new Error('Ошибка при проверке номера на стороне СМ');
        }

        return responseData.data.requestId;
    }

    @RetryOn401()
    async phoneChange(accountId: string, requestId: string, code: string) {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        await this.analyticsTags(accountWithProxyEntity);
        const token = await this.verifyCheck(accountWithProxyEntity, requestId, code);
        await this.changePhone(accountWithProxyEntity, token);
    }

    @RetryOn401()
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

    @RetryOn401()
    private async changePhone(accountWithProxyEntity: AccountWithProxyEntity, token: string): Promise<boolean> {
        const url = this.url + `v1/profile/changePhone`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            token,
        };
        await this.httpService.post(url, payload, httpOptions);
        return true;
    }

    @RetryOn401()
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

    @RetryOn401()
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

    @RetryOn401()
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

    @RetryOn401()
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

    @RetryOn401()
    async createSnapshot(accountId: string): Promise<string> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v1/cart/createSnapshot';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const payload = {};
        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data.data.snapshotUrl;
    }

    @RetryOn401()
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

    @RetryOn401()
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

    @RetryOn401()
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

    @RetryOn401()
    async searchProduct(accountId: string, article: string): Promise<SearchProductInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v2/products/search?limit=10&offset=0';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = { queryText: article, persGateTags: ['A_search', 'auth_login_call'] };

        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data;
    }

    @RetryOn401()
    async getProductById(accountId: string, productId: string): Promise<ProductApiResponse> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v2/products/${productId}`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {};

        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data.data;
    }

    @RetryOn401()
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

    @RetryOn401()
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

    @RetryOn401()
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

    @RetryOn401()
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
        const orders = data?.data?.orders ?? [];
        if (!Array.isArray(orders) || orders.length === 0) return data;

        const byNumber = new Map<string, any>();
        for (const o of orders) {
            if (o?.number) byNumber.set(o.number, o);
        }

        // Парсер ISO-даты из API -> Date | undefined
        const parseOrderDate = (raw: unknown): Date | undefined => {
            if (typeof raw !== 'string') return undefined;
            const d = new Date(raw);
            return isNaN(d.getTime()) ? undefined : d;
        };

        const tasks = Array.from(byNumber.values()).map(async (order: any) => {
            const orderNumber = order?.number as string | undefined;
            if (!orderNumber) return;

            const orderDate = parseOrderDate(order?.date);

            try {
                await this.addOrder(accountId, orderNumber, orderDate);
            } catch (err) {
                //ignore
            }
        });

        await Promise.allSettled(tasks);
        return data;
    }

    @RetryOn401()
    private async orderHistoryPrivate(accountId: string): Promise<OrdersInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v3/orderHistory`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data;
    }

    @RetryOn401()
    async orderInfo(accountId: string, orderNumber: string): Promise<OrderInfoInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v4/order/${orderNumber}`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const payload = {};
        const response = await this.httpService.post(url, payload, httpOptions);
        return response.data;
    }

    @RetryOn401()
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

    @RetryOn401()
    async getPromocodeFromProfile(accountId: string): Promise<PromocodeInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/promo`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data;
    }

    @RetryOn401()
    async getProfile(accountId: string): Promise<DataProfile> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/profile`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data.data;
    }

    @RetryOn401()
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

    @RetryOn401()
    private async getUserGateToken(accountWithProxyEntity: AccountWithProxyEntity): Promise<UserGateTokenInterface> {
        const url = this.url + `v1/profile/userGateToken`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data;
    }

    @RetryOn401()
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

    @RetryOn401()
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

    @RetryOn401()
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

    async getPersonalDiscount(accountId: string): Promise<PersonalDiscountResponse[]> {
        try {
            const personalDiscount = await this.personalDiscount(accountId);
            return personalDiscount.list.map(i => {
                return {
                    dateEnd: i.dateEnd,
                    nodeName: i.nodeName,
                };
            });
        } catch (e: any) {
            throw new Error('Ошибка при получении персональной скидки');
        }
    }

    @RetryOn401()
    async personalDiscount(accountId: string): Promise<PersonalDiscount> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/personal-discount`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {};

        const response = await this.httpService.post(url, payload, httpOptions);
        return response.data.data;
    }

    @RetryOn401()
    async findProductsBySearch(accountId: string, subquery: string, limit = 100, offset = 0): Promise<Products> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v2/products/search?limit=${limit}&offset=${offset}`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            facetAvailabilityApply: false,
            obtainment: { delivery: false, shopNames: [] },
            pageType: 'DiscountsCatalog',
            subquery,
            userInteraction: false,
            woQueryTextCorrection: false,
        };

        const response = await this.httpService.post(url, payload, httpOptions);
        return response.data.data;
    }

    @RetryOn401()
    async getProfileFamily(accountId: string): Promise<ProfileFamilyResponse> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/profile/family`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data.data;
    }

    @RetryOn401()
    async familyInvite(accountId: string, member: InviteMemberFamily): Promise<FamilyInviteResponse> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/profile/family/_invite`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload: InviteMemberFamily = {
            memberPhone: member.memberPhone,
            memberName: member.memberName,
        };

        if (member.familyId) {
            payload.familyId = member.familyId;
        }

        const response = await this.httpService.post<FamilyInviteResponse>(url, payload, httpOptions);
        return response.data;
    }

    @RetryOn401()
    async familyAnswer(accountId: string, familyId: string, answer: boolean): Promise<ProfileFamilyResponse> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/profile/family/${familyId}/_answer`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            answer,
        };

        const response = await this.httpService.post<ProfileFamilyResponse>(url, payload, httpOptions);
        return response.data;
    }

    @RetryOn401()
    async deleteFamily(accountId: string, familyId: string): Promise<ProfileFamilyResponse> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/profile/family/${familyId}`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const response = await this.httpService.delete<ProfileFamilyResponse>(url, httpOptions);
        return response.data;
    }

    @RetryOn401()
    async deleteFamilyMember(accountId: string, member: MemberFamily): Promise<ProfileFamilyResponse> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/profile/family/${member.familyId}/members/${member.memberId}`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const response = await this.httpService.delete<ProfileFamilyResponse>(url, httpOptions);
        return response.data;
    }
}
