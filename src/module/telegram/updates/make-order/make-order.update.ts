import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { ALL_KEYS_MENU_BUTTON_NAME, MAKE_ORDER } from '../base-command/base-command.constants';
import { NotFoundException, OnModuleInit, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { WizardContext } from 'telegraf/typings/scenes';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import {
    ORDER_CHANGE_RECIPIENT_SCENE,
    ORDER_CITY_SCENE,
    ORDER_FAVOURITE_CITY_SCENE,
    ORDER_GET_ORDERS_SCENE,
    ORDER_INPUT_ARTICLE_SCENE,
    ORDER_INPUT_LINK_SCENE,
    ORDER_INPUT_PROMO_SCENE,
    ORDER_MENU_ACCOUNT_SCENE,
    ORDER_MENU_CART_SCENE,
} from '../../scenes/make-order.scene-constant';
import { AccountService } from '../../../account/account.service';
import {
    accessShopsKeyboard,
    cartItemsKeyboard,
    comebackBtn,
    comebackCartkeyboard,
    emptyCartKeyboard,
    getCitiesForDeleteKeyboard,
    getCitiesKeyboard,
    getFoundedCitiesForFavKeyboard,
    getSearchProductKeyboard,
    getSearchSkuKeyboard,
    getUserCitiesKeyboard,
    infoOrderKeyboard,
    mainMenuOrderKeyboard,
    orderHistoryKeyboard,
    ordersInfoKeyboard,
    recipientKeyboard,
} from '../../keyboards/make-order.keyboard';
import { isCityPipe } from '../../pipes/isCity.pipe';
import { ERROR_FIND_CITY, ERROR_FOUND_CASH, ERROR_FOUND_USER } from '../../constants/error.constant';
import { getTextCart } from '../../utils/cart.utils';
import { isUrlPipe } from '../../pipes/isUrl.pipe';
import { prepareForInternalPickupAvailability } from '../../utils/order.utils';
import { MakeOrderService } from './make-order.service';
import { isFioPipe } from '../../pipes/isFio.pipe';
import { IRecipient, IRecipientOrder } from '../../../account/interfaces/account.interface';
import { Context } from '../../interfaces/telegram.context';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { OrderState } from '../../interfaces/order.interface';
import { OrderService } from '../../../order/order.service';
import { BaseUpdate } from '../base/base.update';

const ORDER_TTL = 600;

@Scene(MAKE_ORDER.scene)
@UseFilters(TelegrafExceptionFilter)
export class MakeOrderUpdate extends BaseUpdate {
    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context, @Sender() telegramUser: any) {
        // в будующем удалить регу или обновление юзера
        const { first_name: telegramName, id: telegramId } = telegramUser;
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        await this.userService.createOrUpdateUserByTelegram({
            telegramName,
            telegramId: String(telegramId),
        });

        await ctx.reply('🔑 Введите номер вашего аккаунта:', getMainMenuKeyboard(user.role));
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @On('text')
    async findAccount(
        @Message('text', new isAccountIdPipe()) accountId: string,
        @Sender() { id: telegramId }: any,
        @Ctx() ctx: WizardContext,
    ) {
        const state: OrderState = { accountId };
        await this.cacheService.set(`order_acc:${telegramId}`, state, ORDER_TTL);
        await ctx.scene.enter(ORDER_MENU_ACCOUNT_SCENE);
    }
}

@Scene(ORDER_MENU_ACCOUNT_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderMenuAccount extends BaseUpdate {
    constructor(private accountService: AccountService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        const shortInfo = await this.accountService.shortInfo(account.accountId);
        const text = `📱 Аккаунт найден. Баланс: ${shortInfo.bonusCount}`;

        const keyboard = mainMenuOrderKeyboard(shortInfo.citySMName);

        if (ctx.updateType === 'callback_query') {
            await ctx.editMessageText(text, keyboard);
        } else {
            await ctx.reply(text, keyboard);
        }
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @Action('go_to_city')
    async choosingWayCity(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_CITY_SCENE);
    }

    @Action('go_to_cart')
    async choosingWayCart(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_MENU_CART_SCENE);
    }

    @Action('go_to_orders')
    async choosingWayOrder(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_GET_ORDERS_SCENE);
    }
}

@Scene(ORDER_CITY_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderCity extends BaseUpdate {
    constructor(
        private accountService: AccountService,
        private makeOrderService: MakeOrderService,
    ) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const userCities = await this.userService.getUserCities(String(telegramId));
        const keyboard = getUserCitiesKeyboard(userCities);

        const text = 'Введите название города для его изменения. Либо выберете из Ваших избранных';
        if (ctx.updateType === 'callback_query') {
            await ctx.editMessageText(text, keyboard);
        } else {
            await ctx.reply(text, keyboard);
        }
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputCity(@Message('text', new isCityPipe()) city: string, @Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');
        const suggestCitysByGeo = await this.accountService.suggestCityByGeo(account.accountId, city);
        if (suggestCitysByGeo.length == 0) {
            await ctx.reply(ERROR_FIND_CITY);
            await ctx.scene.reenter();
            return;
        }

        const formattingGeo = this.makeOrderService.formatGeo(suggestCitysByGeo);
        account.geo = formattingGeo;
        await this.cacheService.set(`order_acc:${telegramId}`, account, ORDER_TTL);

        const keyboard = getCitiesKeyboard(formattingGeo);
        await ctx.reply('Выберете город для изменения', keyboard);
    }

    @Action(/^find_uri_(.+)$/)
    async setCity(@Sender() { id: telegramId }: any, @Ctx() ctx: WizardContext) {
        //@ts-ignore
        const id = ctx.match[0].split('_')[2];
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account?.geo) return ctx.reply('Сессия истекла.');

        const uri = account.geo.find(i => i.id === id)?.uri;
        if (!uri) throw new NotFoundException(ERROR_FOUND_CASH);

        await this.accountService.setAccountCity(account.accountId, uri);
        await ctx.scene.enter(ORDER_MENU_ACCOUNT_SCENE);
    }

    @Action(/^id_favourite_city_(.+)$/)
    async selectFavouriteCity(@Sender() { id: telegramId }: any, @Ctx() ctx: WizardContext) {
        //@ts-ignore
        const cityId = ctx.match[0].split('_')[3];
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        await this.accountService.setCityToAccount(account.accountId, cityId);
        await ctx.scene.enter(ORDER_MENU_ACCOUNT_SCENE);
    }

    @Action('add_new_user_city')
    async addFavouriteCity(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_FAVOURITE_CITY_SCENE);
    }

    @Action('del_favourite_city')
    async selectDelFavouriteCity(@Sender() { id: telegramId }: any, @Ctx() ctx: WizardContext) {
        const userCities = await this.userService.getUserCities(String(telegramId));
        const keyboard = getCitiesForDeleteKeyboard(userCities);
        await ctx.editMessageText('Выберете город для удаления', keyboard);
    }

    @Action(/^del_city_\d+$/)
    async delFavouriteCity(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        //@ts-ignore
        const cityId = ctx.match[0].split('_')[2];

        await this.userService.deleteUserCity(String(telegramId), cityId);
        await ctx.scene.enter(ORDER_CITY_SCENE);
    }

    @Action('re_enter_scene')
    async reEnterScene(@Ctx() ctx: WizardContext) {
        await ctx.scene.reenter();
    }

    @Action('go_to_menu')
    async goToMenu(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_MENU_ACCOUNT_SCENE);
    }
}

@Scene(ORDER_FAVOURITE_CITY_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderFavouriteCity extends BaseUpdate {
    constructor(
        private accountService: AccountService,
        private makeOrderService: MakeOrderService,
    ) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.editMessageText('Введите название города для добавления в избранное', comebackBtn);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputFavouriteCity(
        @Message('text', new isCityPipe()) city: string,
        @Ctx() ctx: WizardContext,
        @Sender() { id: telegramId }: any,
    ) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        const suggestCitysByGeo = await this.accountService.suggestCityByGeo(account.accountId, city);
        if (suggestCitysByGeo.length == 0) {
            await ctx.reply(ERROR_FIND_CITY);
            await ctx.scene.reenter();
            return;
        }

        const formattingGeo = this.makeOrderService.formatGeo(suggestCitysByGeo);
        account.geo = formattingGeo;
        await this.cacheService.set(`order_acc:${telegramId}`, account, ORDER_TTL);

        const keyboard = getFoundedCitiesForFavKeyboard(formattingGeo);
        await ctx.reply('Выберете город для добавления', keyboard);
    }

    @Action(/^add_favourite_city_(.+)$/)
    async selectFavouriteCity(@Sender() { id: telegramId }: any, @Ctx() ctx: WizardContext) {
        //@ts-ignore
        const id = ctx.match[0].split('_')[3];
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account?.geo) return ctx.reply('Сессия истекла.');

        const uri = account.geo.find(i => i.id === id)?.uri;
        if (!uri) throw new NotFoundException(ERROR_FOUND_CASH);

        const city = await this.accountService.getCity(account.accountId, uri);

        await this.userService.addUserCity(String(telegramId), city.cityId);
        await ctx.scene.enter(ORDER_CITY_SCENE);
    }

    @Action('go_back')
    async reEnterScene(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_CITY_SCENE);
    }
}

@Scene(ORDER_MENU_CART_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderMenuCart extends BaseUpdate {
    constructor(
        private accountService: AccountService,
        private makeOrderService: MakeOrderService,
    ) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        const cartResponse = await this.accountService.getCart(account.accountId);
        account.email = cartResponse.data.cartFull.owner.email;
        await this.cacheService.set(`order_acc:${telegramId}`, account, ORDER_TTL);

        let keyboard;
        let text;
        if (cartResponse.data.cartFull.soldOutLines.length != 0) {
            keyboard = cartItemsKeyboard(cartResponse.data.cartFull.soldOutLines);
            text = 'В корзине есть товары, которые нельзя заказать';
        } else if (cartResponse.data.cartFull.availableItems.length != 0) {
            keyboard = cartItemsKeyboard(cartResponse.data.cartFull.availableItems);
            text = getTextCart(cartResponse);
            account.cartResponse = cartResponse;
            await this.cacheService.set(`order_acc:${telegramId}`, account, ORDER_TTL);
        } else {
            keyboard = emptyCartKeyboard;
            text = 'Выберете действие';
        }

        try {
            await ctx.editMessageText(text, keyboard);
        } catch {
            await ctx.reply(text, keyboard);
        }
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @Action('add_order_link')
    async addOrderLink(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_INPUT_LINK_SCENE);
    }

    @Action('share_cart')
    async shareCartLink(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        const url = await this.accountService.createSnapshot(account.accountId);
        await ctx.reply(url);
        await ctx.scene.reenter();
    }

    @Action('add_item_cart')
    async addProduct(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_INPUT_ARTICLE_SCENE);
    }

    @Action('shop_selection')
    async choosingShopOrder(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        //Не понятно, как определить, что есть самовывоз
        // const nonAccessItems = isAccessShop(account.cartResponse!);

        // if (nonAccessItems.length != 0) return await ctx.reply(`❌ ${nonAccessItems.join(', ')} Нет доступности для заказа`);

        const internalPickupAvabilityItems = prepareForInternalPickupAvailability(account.cartResponse!);
        const accessItemsPickupAvailability = await this.accountService.internalPickupAvailability(
            account.accountId,
            internalPickupAvabilityItems,
        );
        account.internalPickupAvabilityItems = internalPickupAvabilityItems;
        account.accessItemsPickupAvailability = accessItemsPickupAvailability;

        await this.cacheService.set(`order_acc:${telegramId}`, account, ORDER_TTL);

        const keyboardShops = accessShopsKeyboard(accessItemsPickupAvailability);
        await ctx.editMessageText('Выберите ТЦ', keyboardShops);
    }

    @Action(/^id_shop_\d+$/)
    async approveShop(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        //@ts-ignore
        const shopId = ctx.match[0].split('_')[2];
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        const { text, keyboard, shop } = await this.makeOrderService.approveShop(account, shopId);
        if (shop) {
            account.shop = shop;
            await this.cacheService.set(`order_acc:${telegramId}`, account, ORDER_TTL);
        }
        await ctx.editMessageText(text, keyboard);
    }

    @Action('approve_shop')
    async choiceChangeRecipient(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account?.shop?.shopNumber || !account.internalPickupAvabilityItems) return ctx.reply('Сессия истекла.');

        const shopId = String(account.shop.shopNumber);

        const { potentialOrder, version } = await this.accountService.internalPickup(
            account.accountId,
            shopId,
            account.internalPickupAvabilityItems,
        );
        account.version = version;
        account.potentialOrder = potentialOrder;
        await this.cacheService.set(`order_acc:${telegramId}`, account, ORDER_TTL);

        await ctx.editMessageText(`Изменить получателя заказа?`, recipientKeyboard);
    }

    @Action('recipient_i')
    async orderConfirmation(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        const orderNumber = await this.accountService.submitOrder(account.accountId, account.version!);

        await ctx.editMessageText(`Поздравляю! Ваш заказ под номером: <code>${orderNumber}</code>`, {
            parse_mode: 'HTML',
            ...ordersInfoKeyboard,
        });
    }

    @Action('recipient_not_i')
    async changeRecipient(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_CHANGE_RECIPIENT_SCENE);
    }

    @Action('go_to_orders')
    async selectOrder(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_GET_ORDERS_SCENE);
    }

    @Action('add_promo')
    async addPromo(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_INPUT_PROMO_SCENE);
    }

    @Action('delete_promo')
    async deletePromo(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        await this.accountService.deletePromocode(account.accountId);
        await ctx.reply('Промокод удален');
        await ctx.scene.reenter();
    }

    @Action('clear_cart')
    async clearCart(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        await this.accountService.removeAllCart(account.accountId);
        await ctx.reply('Вещи удалены из списка');
        await ctx.scene.reenter();
    }

    @Action(/id_remove_\d+_\d+/)
    async removeItemCart(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        //@ts-ignore
        const productId = ctx.match[0].split('_')[2];
        const item = account.cartResponse?.data.cartFull.availableItems.filter(item => item.cartItemId.productId == productId);
        if (item && item.length == 0) return;

        //@ts-ignore
        const linesIds = item[0].cartItemId.linesIds;

        //@ts-ignore
        const sku = ctx.match[0].split('_')[3];

        // @ts-ignore
        await this.accountService.removeFromCart(account.accountId, [{ productId, sku, linesIds }]);
        await ctx.scene.reenter();
    }

    @Action(/id_add_\d+_\d+/)
    async addItemCart(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        //@ts-ignore
        const productId = ctx.match[0].split('_')[2];

        //@ts-ignore
        const sku = ctx.match[0].split('_')[3];

        await this.accountService.addInCart(account.accountId, { productId, sku });
        await ctx.scene.reenter();
    }

    @Action('go_to_menu')
    async goToMenu(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_MENU_ACCOUNT_SCENE);
    }

    @Action('go_back')
    async choosingWayCart(@Ctx() ctx: WizardContext) {
        await ctx.scene.reenter();
    }
}

@Scene(ORDER_INPUT_ARTICLE_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderInputArticle extends BaseUpdate {
    constructor(private accountService: AccountService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.editMessageText('Введите артикул или название вещи:', comebackBtn);
    }

    @Action('go_back')
    async choosingWayCart(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_MENU_CART_SCENE);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @On('text')
    async searchingAddingArticle(@Message('text') article: string, @Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        const foundedProduct = await this.accountService.searchProduct(account.accountId, article);
        let text;
        if (foundedProduct.data.list.length != 0) {
            text = 'Выберете товар';
            account.foundedProduct = foundedProduct;
            await this.cacheService.set(`order_acc:${telegramId}`, account, ORDER_TTL);
        } else {
            text = 'Товар не найден';
        }
        const keyboard = getSearchProductKeyboard(foundedProduct);
        await ctx.reply(text, keyboard);
    }

    @Action(/id_product_\d/)
    async selectProduct(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account || !account.foundedProduct) return ctx.reply('Сессия истекла.');

        //@ts-ignore
        const productId = ctx.update.callback_query.data.split('_')[2];

        const foundedProduct = account.foundedProduct;
        const list = foundedProduct.data.list;
        const item = list.filter(value => value.id == productId)[0];
        const keyboard = getSearchSkuKeyboard(productId, foundedProduct);
        if (!keyboard) {
            await ctx.editMessageText('Доступных размеров нет', comebackBtn);
        } else {
            await ctx.editMessageText(item.name, keyboard);
        }
    }

    @Action(/id_add_\d+_\d+/)
    async addItemCart(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        //@ts-ignore
        const productId = ctx.match[0].split('_')[2];

        //@ts-ignore
        const sku = ctx.match[0].split('_')[3];

        await this.accountService.addInCart(account.accountId, { productId, sku });
        await ctx.scene.enter(ORDER_MENU_CART_SCENE);
    }
}

@Scene(ORDER_INPUT_LINK_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderInputLink extends BaseUpdate {
    constructor(private accountService: AccountService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.editMessageText('Отправьте ссылку, которую скопировали из мобильного приложения', comebackBtn);
    }

    @Action('go_back')
    async choosingWayCart(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_MENU_CART_SCENE);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @On('text')
    async addOrderLink(@Message('text', new isUrlPipe()) urlLink: string, @Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        await this.accountService.applySnapshot(account.accountId, urlLink);
        await ctx.reply('Товары были добавлены в корзину');
        await ctx.scene.enter(ORDER_MENU_CART_SCENE);
    }
}

@Scene(ORDER_INPUT_PROMO_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderInputPromo extends BaseUpdate {
    constructor(private accountService: AccountService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.editMessageText('Введите промокод', comebackBtn);
    }

    @Action('go_back')
    async choosingWayCart(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_MENU_CART_SCENE);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputPromocode(@Message('text') promocode: string, @Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        await this.accountService.addPromocode(account.accountId, promocode);
        await ctx.reply('Промокод успешно применен');
        await ctx.scene.enter(ORDER_MENU_CART_SCENE);
    }
}

@Scene(ORDER_CHANGE_RECIPIENT_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderChangeRecipient extends BaseUpdate {
    constructor(private accountService: AccountService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        await ctx.editMessageText(
            `Введите Имя, Фамилию, email и номер телефона через пробелы:\nИванов Иван <code>${account.email}</code> 88005553535`,
            {
                parse_mode: 'HTML',
                ...comebackCartkeyboard,
            },
        );
    }

    @Action('go_to_cart')
    async choosingWayCart(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_MENU_CART_SCENE);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputRecipient(
        @Message('text', new isFioPipe()) fioData: IRecipient,
        @Sender() { id: telegramId }: any,
        @Ctx() ctx: WizardContext,
    ) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account || !account.potentialOrder) return ctx.reply('Сессия истекла.');

        const data: IRecipientOrder = {
            ...fioData,
            potentialOrder: account.potentialOrder,
        };

        const version = await this.accountService.approveRecipientOrder(account.accountId, data);
        const orderNumber = await this.accountService.submitOrder(account.accountId, version);
        await ctx.reply(`Поздравляю! Ваш заказ под номером: <code>${orderNumber}</code>`, {
            parse_mode: 'HTML',
            ...ordersInfoKeyboard,
        });
    }

    @Action('go_to_orders')
    async selectOrder(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_GET_ORDERS_SCENE);
    }
}

@Scene(ORDER_GET_ORDERS_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderGetOrders extends BaseUpdate implements OnModuleInit {
    private DOMAIN: string;

    constructor(
        private accountService: AccountService,
        private orderService: OrderService,
    ) {
        super();
    }

    onModuleInit() {
        this.DOMAIN = this.configService.getOrThrow('DOMAIN');
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        const orders = await this.orderService.orderHistory(account.accountId);
        const keyboard = orderHistoryKeyboard(orders);
        const text = 'Имеющиеся заказы на аккаунте:';
        try {
            await ctx.editMessageText(text, keyboard);
        } catch {
            await ctx.reply(text, keyboard);
        }
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @Action(/^order_(\d+)-\d+$/)
    async selectOrder(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');
        //@ts-ignore
        const orderNumber = ctx.match[0].split('_')[1];
        const order = await this.accountService.orderInfo(account.accountId, orderNumber);
        const keyboard = infoOrderKeyboard(account.accountId, order.data.order.number, order.data.order.isCancelled, this.DOMAIN);

        const text = `Заказ номер: <code>${order.data.order.number}</code>`;
        await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            ...keyboard,
        });
    }

    @Action(/^cancelled_order_(\d+)-\d+$/)
    async cancellOrder(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<OrderState>(`order_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');
        //@ts-ignore
        const orderNumber = ctx.match[0].split('_')[2];
        await this.accountService.cancellOrder(account.accountId, orderNumber);

        await ctx.reply('Заказ отменен');
        await ctx.scene.reenter();
    }

    @Action('go_to_menu')
    async goToMenu(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_MENU_ACCOUNT_SCENE);
    }
}
