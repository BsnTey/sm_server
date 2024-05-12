import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import md5 from 'md5';
import { HashString, IHashAplaut } from './interfaces/sport.interface';
import { AccountEntity } from '../account/entities/account.entity';
import { IRefreshAccount } from '../account/interfaces/account.interface';

export class SportApi {
    private prefixHash = 'eb1a3e30291bc971c4da0e86375961a4';
    private httpsAgent: SocksProxyAgent;
    private proxy: string | null = null;
    private cityId = '1720920299';
    public cityName = 'Москва';
    accountId: string;
    private accessToken: string;
    private refreshToken: string;
    private xUserId: string;
    private deviceId: string;
    private installationId: string;
    expiresIn: Date | null;

    public bonusCount: number | null = null;
    public qrCode: string | null = null;

    public emailOwner: string | null = null;
    // public itemsCart: Array<IItemListCart> | null = null;
    public rawItemsCart: Array<any> | null = null;
    public rawListDetailsBonus: Array<any> | null = null;

    public amountThreeDays: number | null = null;
    public promocodes: Array<string> | null = null;

    constructor(account: AccountEntity) {
        this.accountId = account.accountId;
        this.accessToken = account.accessToken;
        this.refreshToken = account.refreshToken;
        this.xUserId = account.xUserId;
        this.deviceId = account.deviceId;
        this.installationId = account.installationId;
        this.expiresIn = account.expiresIn;
    }

    setProxy(proxy: string) {
        this.proxy = proxy;
        this.httpsAgent = new SocksProxyAgent(proxy);
    }

    private generateHash({ url, timestamp }: IHashAplaut): HashString {
        const combinedString = this.prefixHash + url + timestamp + this.xUserId;
        console.log(combinedString);
        return md5(combinedString);
    }

    getHeaders(url: string) {
        const timestamp = String(Date.now());
        const hash = this.generateHash({ url, timestamp });

        return {
            'User-Agent': 'android-4.44.0-google(44971)',
            Locale: 'ru',
            Country: 'RU',
            'Device-Id': this.deviceId,
            'Installation-Id': this.installationId,
            'City-Id': this.cityId,
            Eutc: 'UTC+3',
            'x-user-id': this.xUserId,
            Authorization: this.accessToken,
            Host: 'mp4x-api.sportmaster.ru',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json; charset=utf-8',
            Timestamp: timestamp,
            'Aplaut-Id': hash,
            'Aplaut-Build': '2',
        };
    }

    // setCity(cityId, cityName): void {
    //     this.cityId = cityId;
    //     this.cityName = cityName;
    // }

    async refresh(): Promise<IRefreshAccount> {
        const url = 'https://mp4x-api.sportmaster.ru/api/v1/auth/refresh';
        const headers = this.getHeaders(url);

        const payload = {
            refreshToken: this.refreshToken,
            deviceId: this.deviceId,
        };
        const response = await axios.post(url, payload, {
            headers,
            httpsAgent: this.httpsAgent,
        });

        this.accessToken = response.data.data.token.accessToken;
        this.refreshToken = response.data.data.token.refreshToken;
        const expires = response.data.data.token.expiresIn;
        const expiresInTimestamp = Date.now() + +expires * 1000;
        const expiresInDate = new Date(expiresInTimestamp);
        this.expiresIn = expiresInDate;

        return {
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            expiresIn: expiresInDate,
        };
    }
    async shortInfo() {
        const url = 'https://mp4x-api.sportmaster.ru/api/v2/bonus/shortInfo';
        const headers = this.getHeaders(url);
        const response = await axios.get(url, {
            headers,
            httpsAgent: this.httpsAgent,
        });
        const bonusCount: number = +response.data.data.info.totalAmount;
        const qrCode: string = response.data.data.info.clubCard.qrCode;
        return { bonusCount, qrCode };
    }

    // async detailsBonus(): Promise<boolean> {
    //     const today = new Date();
    //     const year = today.getFullYear();
    //     const month = String(today.getMonth() + 1).padStart(2, '0');
    //     const day = String(today.getDate()).padStart(2, '0');
    //
    //     const formattedDate = `${year}-${month}-${day}`;
    //
    //     const url = `https://mp4x-api.sportmaster.ru/api/v1/bonus/detailsByDay?dateBegin=${formattedDate}&dateEnd=2024-02-28`;
    //     this.setHeaders(url);
    //
    //     try {
    //         const response = await axios.get(url, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         this.rawListDetailsBonus = response.data.data.list;
    //         this.bonusCount = this.rawListDetailsBonus[0].amount;
    //
    //         return true;
    //     } catch (err) {
    //         throw new Error(err.data);
    //     }
    // }
    //
    // async getListCart(): Promise<boolean> {
    //     const url = 'https://mp4x-api.sportmaster.ru/api/v1/cart?clearDeletedLines=true&cartResponse=FULL';
    //     this.setHeaders(url);
    //     try {
    //         const response = await axios.get(url, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         this.itemsCart = parsingListCart(response.data);
    //         this.rawItemsCart = response.data;
    //         this.emailOwner = response.data.data.cartFull.owner.email;
    //
    //         return true;
    //     } catch {
    //         return false;
    //     }
    // }

    // async searchProduct(article: string): Promise<any> | null {
    //     const url = 'https://mp4x-api.sportmaster.ru/api/v2/products/search?limit=50&offset=0';
    //     this.setHeaders(url);
    //
    //     const payload = { queryText: article, persGateTags: ['A_search', 'auth_login_call'] };
    //
    //     try {
    //         const response = await axios.post(url, payload, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         const data = response.data.data.list[0];
    //         return data;
    //     } catch {
    //         return null;
    //     }
    // }
    //
    // async addItemCart(productId: string, sku: string): Promise<any> {
    //     const url = 'https://mp4x-api.sportmaster.ru/api/v1/cart/add';
    //     this.setHeaders(url);
    //
    //     const payload = {
    //         id: {
    //             productId: productId,
    //             sku: sku,
    //         },
    //         quantity: 1,
    //         cartFormat: 'LITE',
    //     };
    //
    //     try {
    //         const response = await axios.post(url, payload, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         return response.data;
    //     } catch {
    //         return false;
    //     }
    // }
    //
    // async findCity(city: string): Promise<any> {
    //     city = city.toUpperCase();
    //     const encodedCity = encodeURI(city);
    //
    //     const url = `https://mp4x-api.sportmaster.ru/api/v1/city?query=${encodedCity}`;
    //     this.setHeaders(url);
    //
    //     let foundCities = [];
    //     try {
    //         const response = await axios.get(url, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         foundCities = response.data.data.list;
    //     } catch {
    //         // skip
    //     }
    //     return foundCities;
    // }
    //
    // async applySnapshot(snapshotUrl: string): Promise<boolean> {
    //     const url = 'https://mp4x-api.sportmaster.ru/api/v1/cart/add';
    //     this.setHeaders(url);
    //
    //     const payload = {
    //         snapshotUrl: snapshotUrl,
    //     };
    //
    //     try {
    //         const response = await axios.post(url, payload, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         return true;
    //     } catch {
    //         return false;
    //     }
    // }
    //
    // async createSnapshot(): Promise<string> | null {
    //     const url = 'https://mp4x-api.sportmaster.ru/api/v1/cart/createSnapshot';
    //     this.setHeaders(url);
    //
    //     try {
    //         const response = await axios.post(
    //             url,
    //             {},
    //             {
    //                 headers: this.headers,
    //                 httpsAgent: this.httpsAgent,
    //             },
    //         );
    //
    //         return response.data.data.snapshotUrl;
    //     } catch {
    //         return null;
    //     }
    // }
    //
    // async removeItemFromCart(removeList: IItemListCart[]): Promise<boolean> {
    //     const url = 'https://mp4x-api.sportmaster.ru/api/v1/cart/remove';
    //     this.setHeaders(url);
    //
    //     const ids = removeList.map((item: IItemListCart) => {
    //         return {
    //             productId: item.productId,
    //             sku: item.sku,
    //         };
    //     });
    //
    //     const payload = {
    //         ids: ids,
    //         cartFormat: 'FULL',
    //     };
    //
    //     try {
    //         const response = await axios.post(url, payload, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         return true;
    //     } catch {
    //         return false;
    //     }
    // }
    //
    // async addPromocode(promocode: string): Promise<boolean> {
    //     const url = 'https://mp4x-api.sportmaster.ru/api/v1/cart/promoCode';
    //     this.setHeaders(url);
    //
    //     const payload = {
    //         promoCode: promocode,
    //     };
    //
    //     try {
    //         const response = await axios.post(url, payload, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         return true;
    //     } catch {
    //         return false;
    //     }
    // }
    //
    // async deletePromocode(promocode: string): Promise<boolean> {
    //     const url = 'https://mp4x-api.sportmaster.ru/api/v1/cart/promoCode';
    //     this.setHeaders(url);
    //
    //     try {
    //         const response = await axios.delete(url, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         return true;
    //     } catch {
    //         return false;
    //     }
    // }
    //
    // async internalPickupAvailability(): Promise<any> {
    //     const preparingCartItem = refactorItemsCart(this.itemsCart);
    //     const url = 'https://mp4x-api.sportmaster.ru/api/v2/cart/internalPickupAvailability';
    //     this.setHeaders(url);
    //
    //     const payload = {
    //         cartItemIds: preparingCartItem,
    //     };
    //
    //     try {
    //         const response = await axios.post(url, payload, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         return response.data.data.list;
    //     } catch (err) {
    //         throw new Error(err.data);
    //     }
    // }
    //
    // async internalPickup(shopId: string): Promise<{ potentialOrder: string; version: string }> {
    //     const preparingCartItem = refactorItemsCart(this.itemsCart);
    //     const url = 'https://mp4x-api.sportmaster.ru/api/v1/cart/obtainPoint/internalPickup';
    //     this.setHeaders(url);
    //
    //     const payload = {
    //         shopNumber: shopId,
    //         cartItemIds: preparingCartItem,
    //     };
    //
    //     try {
    //         const response = await axios.post(url, payload, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         const data = response.data.data.cart.obtainPoints[0];
    //         const potentialOrder = data.potentialOrder.id;
    //         const version = response.data.data.cart.version;
    //
    //         return { potentialOrder, version };
    //     } catch (err) {
    //         throw new Error(err.data);
    //     }
    // }
    //
    // async submitOrder(version: string): Promise<any> {
    //     const url = 'https://mp4x-api.sportmaster.ru/api/v1/cart/submit';
    //     this.setHeaders(url);
    //
    //     const payload = {
    //         cartVersion: version,
    //     };
    //
    //     try {
    //         const response = await axios.post(url, payload, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         const orderNumber = response.data.data.orders[0];
    //         return orderNumber.orderNumber;
    //     } catch (err) {
    //         throw new Error(err.data);
    //     }
    // }
    //
    // async orderHistory(): Promise<any> | null {
    //     const url = `https://mp4x-api.sportmaster.ru/api/v4/orderHistory`;
    //     this.setHeaders(url);
    //
    //     try {
    //         const response = await axios.get(url, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         return response.data.data.orders;
    //     } catch (err) {
    //         throw new Error(err.data);
    //     }
    // }
    //
    // async orderInfo(orderNumber: string): Promise<any> {
    //     const url = `https://mp4x-api.sportmaster.ru/api/v1/order/${orderNumber}`;
    //     this.setHeaders(url);
    //
    //     try {
    //         const response = await axios.post(url, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         return response.data.data.order;
    //     } catch (err) {
    //         throw new Error(err.data);
    //     }
    // }
    //
    // async cancellOrder(orderNumber: string): Promise<any> {
    //     const reasons = [103, 104, 105, 106];
    //     const randomIndex = Math.floor(Math.random() * reasons.length);
    //     const reason = reasons[randomIndex];
    //
    //     const url = `https://mp4x-api.sportmaster.ru/api/v1/order/${orderNumber}`;
    //     this.setHeaders(url);
    //
    //     const payload = {
    //         cancelReasonId: reason,
    //     };
    //
    //     try {
    //         const response = await axios.post(url, payload, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         return true;
    //     } catch (err) {
    //         throw new Error(err.data);
    //     }
    // }
    //
    // async approveRecipientOrder(recipient: IRecipientOrder): Promise<any> {
    //     const url = `https://mp4x-api.sportmaster.ru/api/v1/cart/order/${recipient.potentialOrder}/receiver`;
    //     this.setHeaders(url);
    //
    //     const payload = {
    //         receiver: {
    //             fio: `${recipient.firstName} ${recipient.lastName}`,
    //             phone: { countryCode: 7, nationalNumber: `${recipient.nationalNumber}`, isoCode: 'RU' },
    //             email: `${recipient.email}`,
    //         },
    //     };
    //
    //     try {
    //         const response = await axios.post(url, payload, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         return response.data.data.cart.version;
    //     } catch (err) {
    //         throw new Error(err.response.data.error.message);
    //     }
    // }
    //
    // async sendSms(phoneNumber): Promise<any> {
    //     const url = `https://mp4x-api.sportmaster.ru/api/v1/verify/sendSms`;
    //     this.setHeaders(url);
    //
    //     const payload = {
    //         phone: {
    //             countryCode: 7,
    //             nationalNumber: phoneNumber,
    //             isoCode: 'RU',
    //         },
    //         operation: 'change_phone',
    //         communicationChannel: 'SMS',
    //     };
    //
    //     try {
    //         const response = await axios.post(url, payload, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         return response.data.data.requestId;
    //     } catch (err) {
    //         throw new Error(err.response.data.error.code);
    //     }
    // }
    //
    // async verifyCheck(requestId: string, code: string): Promise<string> {
    //     const url = `https://mp4x-api.sportmaster.ru/api/v1/verify/check`;
    //     this.setHeaders(url);
    //
    //     const payload = {
    //         requestId,
    //         code,
    //     };
    //
    //     try {
    //         const response = await axios.post(url, payload, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         return response.data.data.token;
    //     } catch (err) {
    //         throw new Error(err.response.data.error.code);
    //     }
    // }
    //
    // async changePhone(token: string): Promise<any> {
    //     const url = `https://mp4x-api.sportmaster.ru/api/v1/profile/changePhone`;
    //     this.setHeaders(url);
    //
    //     const payload = {
    //         token,
    //     };
    //
    //     try {
    //         const response = await axios.post(url, payload, {
    //             headers: this.headers,
    //             httpsAgent: this.httpsAgent,
    //         });
    //
    //         return true;
    //     } catch (err) {
    //         throw new Error(err.response.data.error.code);
    //     }
    // }
}
