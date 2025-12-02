import { HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AccountRepository } from './account.repository';
import { AddingAccountRequestDto } from './dto/create-account.dto';
import { AccountEntity } from './entities/account.entity';
import {
    AccountWDevice,
    AddressSuggestList,
    IAccountWithProxy,
    IAccountWithProxyFromDB,
    IRecipientOrder,
    IRefreshAccount,
    ResolvedCity,
} from './interfaces/account.interface';
import { CitySM, CourseStatus, LessonStatus } from '@prisma/client';
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
import { PersonalDiscount } from './interfaces/personal-discount.interface';
import { ProfileFamilyResponse } from './interfaces/profile-family.interface';
import { FamilyInviteResponse, InviteMemberFamily, MemberFamily } from './interfaces/family-invite.interface';
import { ProductApiResponse } from './interfaces/product.interface';
import { Cookie } from './interfaces/cookie.interface';
import { Products } from './interfaces/products.interface';
import { RetryOnProxyError } from './decorators/retry-on-proxy-error.decorator';
import { RedisCacheService } from '../cache/cache.service';
import { getAccountEntityKey } from '../cache/cache.keys';

@Injectable()
export class AccountService {
    private readonly logger = new Logger(AccountService.name);
    private url = this.configService.getOrThrow('API_DONOR');
    private urlSite = this.configService.getOrThrow('API_DONOR_SITE');
    private adminsId: string[] = this.configService.getOrThrow('TELEGRAM_ADMIN_ID').split(',');
    private durationTimeProxyBlock = this.configService.getOrThrow('TIME_DURATION_PROXY_BLOCK_IN_MIN');

    private TTL_CASH_ACCOUNT = 5000;

    constructor(
        private configService: ConfigService,
        private accountRep: AccountRepository,
        private proxyService: ProxyService,
        private readonly tlsForwarder: TlsProxyService,
        private httpService: HttpService,
        private courseService: CourseService,
        private deviceInfoService: DeviceInfoService,
        private sportmasterHeaders: SportmasterHeadersService,
        private readonly cacheService: RedisCacheService,
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

    @RetryOnProxyError()
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

    private async getAndValidateOrSetProxyAccount(
        accountWithProxy: IAccountWithProxyFromDB | IAccountWithProxy,
    ): Promise<AccountWithProxyEntity> {
        const currentTime = new Date();
        const timeBlockedAgo = new Date();
        timeBlockedAgo.setMinutes(currentTime.getMinutes() - +this.durationTimeProxyBlock);

        if (
            !accountWithProxy.proxy ||
            accountWithProxy.proxy.expiresAt < currentTime ||
            (accountWithProxy.proxy.blockedAt && accountWithProxy.proxy.blockedAt > timeBlockedAgo)
        ) {
            const proxy = await this.proxyService.getRandomProxy();
            const newAccountWithProxy = await this.accountRep.setProxyAccount(accountWithProxy.accountId, proxy.uuid);
            return new AccountWithProxyEntity(newAccountWithProxy);
        }
        return new AccountWithProxyEntity(accountWithProxy as IAccountWithProxy);
    }

    async getProxyUuid(accountId: string): Promise<string | null> {
        try {
            const accountWithProxy = await this.rawLoadAccountCore(accountId);
            return accountWithProxy.proxy.uuid;
        } catch (e) {
            return null;
        }
    }

    async rawLoadAccountCore(accountId: string): Promise<AccountWithProxyEntity> {
        const accountWithProxy = await this.accountRep.getAccountWithProxy(accountId);

        if (!accountWithProxy) throw new NotFoundException(ERROR_ACCOUNT_NOT_FOUND);

        return this.getAndValidateOrSetProxyAccount(accountWithProxy);
    }

    private async loadAccountCore(accountId: string): Promise<AccountWithProxyEntity> {
        const accountWithProxy = await this.rawLoadAccountCore(accountId);
        await this.validationToken(accountWithProxy);
        return accountWithProxy;
    }

    async getAccountEntity(accountId: string): Promise<AccountWithProxyEntity> {
        const accountEntityFromCache = await this.cacheService.get<AccountWithProxyEntity>(accountId);
        if (!accountEntityFromCache) {
            const account = await this.loadAccountCore(accountId);
            const key = getAccountEntityKey(accountId);
            await this.cacheService.set(key, account, this.TTL_CASH_ACCOUNT);
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
            const key = getAccountEntityKey(accountId);
            await this.cacheService.del(key);
        }

        return city;
    }

    async setCityToAccount(accountId: string, cityId: string) {
        await this.accountRep.setCityToAccount(accountId, cityId);
    }

    @RetryOn401()
    @RetryOnProxyError()
    async suggestCityByGeo(accountId: string, city: string): Promise<AddressSuggestList[]> {
        const acc = await this.getAccountEntity(accountId);
        const encodedCity = encodeURI(city.toUpperCase());
        const url = this.url + `v1/geo/suggest?query=${encodedCity}`;
        const httpOptions = await this.getHttpOptions(url, acc);
        const response = await this.httpService.get(url, httpOptions);
        return response.data.data.addressSuggestList;
    }

    @RetryOn401()
    @RetryOnProxyError()
    private async getAddressByUri(account: AccountWithProxyEntity, uri: string): Promise<DataAddress> {
        const encodedQuery = encodeURIComponent(uri);
        const url = `${this.url}v1/geo/address?query=${encodedQuery}&mode=URI`;

        const httpOptions = await this.getHttpOptions(url, account);
        const response = await this.httpService.get(url, httpOptions);
        return response.data.data;
    }

    @RetryOn401()
    @RetryOnProxyError()
    private async findCityByCoord(account: AccountWithProxyEntity, coord: GeoPointLng): Promise<DataCoord> {
        const url = this.url + `v1/city/coord?lat=${coord.lat}&lng=${coord.lng}`;
        const httpOptions = await this.getHttpOptions(url, account);
        const response = await this.httpService.get(url, httpOptions);
        return response.data.data;
    }

    @RetryOn401()
    @RetryOnProxyError()
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
        const key = getAccountEntityKey(accountId);
        await this.cacheService.del(key);
        return {
            bonusCount: response.info.totalAmount,
            qrCode: response.info.clubCard.qrCode,
            bonusDetails: response.info.details,
            citySMName: account.citySM.name,
            bonusLevel: response.info.bonusLevel.code,
        };
    }

    @RetryOn401()
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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
    @RetryOnProxyError()
    async phoneChange(accountId: string, requestId: string, code: string) {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        await this.analyticsTags(accountWithProxyEntity);
        const token = await this.verifyCheck(accountWithProxyEntity, requestId, code);
        await this.changePhone(accountWithProxyEntity, token);
    }

    @RetryOn401()
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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
    @RetryOnProxyError()
    async createSnapshot(accountId: string): Promise<string> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v1/cart/createSnapshot';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const payload = {};
        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data.data.snapshotUrl;
    }

    @RetryOn401()
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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
    @RetryOnProxyError()
    async searchProduct(accountId: string, article: string): Promise<SearchProductInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + 'v2/products/search?limit=10&offset=0';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = { queryText: article, persGateTags: ['A_search', 'auth_login_call'] };

        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data;
    }

    @RetryOn401()
    @RetryOnProxyError()
    async getProductById(accountId: string, productId: string): Promise<ProductApiResponse> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v2/products/${productId}`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {};

        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data.data;
    }

    @RetryOn401()
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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

    @RetryOn401()
    @RetryOnProxyError()
    async orderHistory(accountId: string): Promise<OrdersInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v3/orderHistory`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data;
    }

    @RetryOn401()
    @RetryOnProxyError()
    async orderInfo(accountId: string, orderNumber: string): Promise<OrderInfoInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v4/order/${orderNumber}`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const payload = {};
        const response = await this.httpService.post(url, payload, httpOptions);
        return response.data;
    }

    @RetryOn401()
    @RetryOnProxyError()
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
    @RetryOnProxyError()
    async getPromocodeFromProfile(accountId: string): Promise<PromocodeInterface> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/promo`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data;
    }

    @RetryOn401()
    @RetryOnProxyError()
    async getProfile(accountId: string): Promise<DataProfile> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/profile`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data.data;
    }

    @RetryOn401()
    @RetryOnProxyError()
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
    @RetryOnProxyError()
    private async getUserGateToken(accountWithProxyEntity: AccountWithProxyEntity): Promise<UserGateTokenInterface> {
        const url = this.url + `v1/profile/userGateToken`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data;
    }

    @RetryOn401()
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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

    @RetryOn401()
    @RetryOnProxyError()
    async personalDiscount(accountId: string): Promise<PersonalDiscount> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/personal-discount`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {};

        const response = await this.httpService.post(url, payload, httpOptions);
        return response.data.data;
    }

    @RetryOn401()
    @RetryOnProxyError()
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
    @RetryOnProxyError()
    async getProfileFamily(accountId: string): Promise<ProfileFamilyResponse> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/profile/family`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);
        return response.data.data;
    }

    @RetryOn401()
    @RetryOnProxyError()
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
    @RetryOnProxyError()
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
    @RetryOnProxyError()
    async deleteFamily(accountId: string, familyId: string): Promise<ProfileFamilyResponse> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/profile/family/${familyId}`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const response = await this.httpService.delete<ProfileFamilyResponse>(url, httpOptions);
        return response.data;
    }

    @RetryOn401()
    @RetryOnProxyError()
    async deleteFamilyMember(accountId: string, member: MemberFamily): Promise<ProfileFamilyResponse> {
        const accountWithProxyEntity = await this.getAccountEntity(accountId);
        const url = this.url + `v1/profile/family/${member.familyId}/members/${member.memberId}`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const response = await this.httpService.delete<ProfileFamilyResponse>(url, httpOptions);
        return response.data;
    }

    async getBonusCountByAccountIds(accountIds: string[]): Promise<Record<string, number>> {
        if (!accountIds?.length) return {};

        const result: Record<string, number> = {};
        const missedAccountIds: string[] = [];

        // Try to get bonus from cache
        for (const accountId of accountIds) {
            const key = getAccountEntityKey(accountId);
            const cachedEntity = await this.cacheService.get<AccountWithProxyEntity>(key);

            if (cachedEntity) {
                result[accountId] = cachedEntity.bonusCount;
            } else {
                missedAccountIds.push(accountId);
            }
        }

        if (missedAccountIds.length > 0) {
            const bonusMapFromDb = await this.accountRep.getBonusCountByAccountIds(missedAccountIds);
            Object.assign(result, bonusMapFromDb);
        }

        return result;
    }
}
