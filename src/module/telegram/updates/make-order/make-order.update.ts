import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { ALL_KEYS_MENU_BUTTON_NAME, MAKE_ORDER } from '../base-command/base-command.constants';
import { UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { TelegramService } from '../../telegram.service';
import { WizardContext } from 'telegraf/typings/scenes';
import { mainMenuKeyboard } from '../../keyboards/base.keyboard';
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
import { UserService } from '../../../user/user.service';
import { isCityPipe } from '../../pipes/isCity.pipe';
import { ERROR_FIND_CITY } from '../../constants/error.constant';
import { getTextCart } from '../../utils/cart.utils';
import { isUrlPipe } from '../../pipes/isUrl.pipe';
import { prepareForInternalPickupAvailability } from '../../utils/order.utils';
import { MakeOrderService } from './make-order.service';
import { isFioPipe } from '../../pipes/isFio.pipe';
import { IRecipient, IRecipientOrder } from '../../../account/interfaces/account.interface';
import { ConfigService } from '@nestjs/config';
import { Context } from '../../interfaces/telegram.context';

@Scene(MAKE_ORDER.scene)
@UseFilters(TelegrafExceptionFilter)
export class MakeOrderUpdate {
    constructor(
        private telegramService: TelegramService,
        private userService: UserService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context, @Sender() telegramUser: any) {
        // в будующем удалить регу или обновление юзера
        const { first_name: telegramName, id: telegramId } = telegramUser;

        await this.userService.createOrUpdateUserByTelegram({
            telegramName,
            telegramId: String(telegramId),
        });

        await ctx.reply('🔑 Введите номер вашего аккаунта:', mainMenuKeyboard);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async findAccount(
        @Message('text', new isAccountIdPipe()) accountId: string,
        @Sender() { id: telegramId }: any,
        @Ctx() ctx: WizardContext,
    ) {
        await this.telegramService.setTelegramAccountCache(telegramId, accountId);
        await ctx.scene.enter(ORDER_MENU_ACCOUNT_SCENE);
    }
}

@Scene(ORDER_MENU_ACCOUNT_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderMenuAccount {
    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);

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
        await this.telegramService.exitScene(menuBtn, ctx);
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
export class OrderCity {
    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
        private userService: UserService,
    ) {}

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
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputCity(@Message('text', new isCityPipe()) city: string, @Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
        const findCities = await this.accountService.findCity(account.accountId, city);
        if (findCities.length == 0) {
            await ctx.reply(ERROR_FIND_CITY);
            await ctx.scene.reenter();
        }
        const keyboard = getCitiesKeyboard(findCities);
        await ctx.reply('Выберете город для изменения', keyboard);
    }

    @Action(/^id_city_\d+$/)
    async setCity(@Sender() { id: telegramId }: any, @Ctx() ctx: WizardContext) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const cityId = ctx.match[0].split('_')[2];
        const account = await this.telegramService.getFromCache(telegramId);
        await this.accountService.setAccountCity(account.accountId, cityId);
        await this.accountService.getProfile(account.accountId);
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
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
export class OrderFavouriteCity {
    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
        private userService: UserService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.editMessageText('Введите название города для добавления в избранное', comebackBtn);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputFavouriteCity(
        @Message('text', new isCityPipe()) city: string,
        @Ctx() ctx: WizardContext,
        @Sender() { id: telegramId }: any,
    ) {
        const account = await this.telegramService.getFromCache(telegramId);
        const findCities = await this.accountService.findCity(account.accountId, city);
        if (findCities.length == 0) {
            await ctx.reply(ERROR_FIND_CITY);
            await ctx.scene.reenter();
        }
        const keyboard = getFoundedCitiesForFavKeyboard(findCities);
        await ctx.reply('Выберете город для добавления', keyboard);
    }

    @Action(/^add_favourite_city_\d+$/)
    async selectFavouriteCity(@Sender() { id: telegramId }: any, @Ctx() ctx: WizardContext) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const cityId = ctx.match[0].split('_')[3];
        await this.userService.addUserCity(String(telegramId), cityId);
        await ctx.scene.enter(ORDER_CITY_SCENE);
    }

    @Action('go_back')
    async reEnterScene(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_CITY_SCENE);
    }
}

@Scene(ORDER_MENU_CART_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderMenuCart {
    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
        private makeOrderService: MakeOrderService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
        const cartResponse = await this.accountService.getCart(account.accountId);
        account.email = cartResponse.data.cartFull.owner.email;
        let keyboard;
        let text;
        if (cartResponse.data.cartFull.availableItems.length != 0) {
            keyboard = cartItemsKeyboard(cartResponse);
            text = getTextCart(cartResponse);
            account.cartResponse = cartResponse;
        } else {
            keyboard = emptyCartKeyboard;
            text = 'Выберете действие';
        }
        try {
            await ctx.editMessageText(text, keyboard);
        } catch (err) {
            await ctx.reply(text, keyboard);
        }
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @Action('add_order_link')
    async addOrderLink(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ORDER_INPUT_LINK_SCENE);
    }

    @Action('share_cart')
    async shareCartLink(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
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
        const account = await this.telegramService.getFromCache(telegramId);

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

        const keyboardShops = accessShopsKeyboard(accessItemsPickupAvailability);
        await ctx.editMessageText('Выберите ТЦ', keyboardShops);
    }

    @Action(/^id_shop_\d+$/)
    async approveShop(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const shopId = ctx.match[0].split('_')[2];

        const account = await this.telegramService.getFromCache(telegramId);
        const { text, keyboard, shop } = await this.makeOrderService.approveShop(account, shopId);
        if (shop) account.shop = shop;
        await ctx.editMessageText(text, keyboard);
    }

    @Action('approve_shop')
    async choiceChangeRecipient(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
        const shopId = String(account.shop!.shopNumber);

        const { potentialOrder, version } = await this.accountService.internalPickup(
            account.accountId,
            shopId,
            account.internalPickupAvabilityItems,
        );
        account.version = version;
        account.potentialOrder = potentialOrder;

        await ctx.editMessageText(`Изменить получателя заказа?`, recipientKeyboard);
    }

    @Action('recipient_i')
    async orderConfirmation(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
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
        const account = await this.telegramService.getFromCache(telegramId);
        await this.accountService.deletePromocode(account.accountId);
        await ctx.reply('Промокод удален');
        await ctx.scene.reenter();
    }

    @Action('clear_cart')
    async clearCart(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
        await this.accountService.removeAllCart(account.accountId);
        await ctx.reply('Вещи удалены из списка');
        await ctx.scene.reenter();
    }

    @Action(/id_remove_\d+_\d+/)
    async removeItemCart(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const productId = ctx.match[0].split('_')[2];
        const item = account.cartResponse?.data.cartFull.availableItems.filter(item => item.cartItemId.productId == productId);
        if (item && item.length == 0) return;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const linesIds = item[0].cartItemId.linesIds;

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const sku = ctx.match[0].split('_')[3];
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await this.accountService.removeFromCart(account.accountId, [{ productId, sku, linesIds }]);
        await ctx.scene.reenter();
    }

    @Action(/id_add_\d+_\d+/)
    async addItemCart(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const productId = ctx.match[0].split('_')[2];

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
export class OrderInputArticle {
    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
    ) {}

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
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async searchingAddingArticle(@Message('text') article: string, @Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);

        const foundedProduct = await this.accountService.searchProduct(account.accountId, article);
        let text;
        if (foundedProduct.data.list.length != 0) {
            text = 'Выберете товар';
            account.foundedProduct = foundedProduct;
        } else {
            text = 'Товар не найден';
        }
        const keyboard = getSearchProductKeyboard(foundedProduct);
        await ctx.reply(text, keyboard);
    }

    @Action(/id_product_\d/)
    async selectProduct(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const productId = ctx.update.callback_query.data.split('_')[2];

        const foundedProduct = account.foundedProduct!;
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
        const account = await this.telegramService.getFromCache(telegramId);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const productId = ctx.match[0].split('_')[2];

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const sku = ctx.match[0].split('_')[3];

        await this.accountService.addInCart(account.accountId, { productId, sku });
        await ctx.scene.enter(ORDER_MENU_CART_SCENE);
    }
}

@Scene(ORDER_INPUT_LINK_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderInputLink {
    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
    ) {}

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
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async addOrderLink(@Message('text', new isUrlPipe()) urlLink: string, @Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);

        await this.accountService.applySnapshot(account.accountId, urlLink);
        await ctx.reply('Товары были добавлены в корзину');
        await ctx.scene.enter(ORDER_MENU_CART_SCENE);
    }
}

@Scene(ORDER_INPUT_PROMO_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderInputPromo {
    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
    ) {}

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
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputPromocode(@Message('text') promocode: string, @Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
        await this.accountService.addPromocode(account.accountId, promocode);
        await ctx.reply('Промокод успешно применен');
        await ctx.scene.enter(ORDER_MENU_CART_SCENE);
    }
}

@Scene(ORDER_CHANGE_RECIPIENT_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class OrderChangeRecipient {
    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
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
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputRecipient(
        @Message('text', new isFioPipe()) fioData: IRecipient,
        @Sender() { id: telegramId }: any,
        @Ctx() ctx: WizardContext,
    ) {
        const account = await this.telegramService.getFromCache(telegramId);
        const data: IRecipientOrder = {
            ...fioData,
            potentialOrder: account.potentialOrder!,
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
export class OrderGetOrders {
    private DOMAIN = this.configService.getOrThrow('DOMAIN', 'http://localhost:3001');

    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
        private configService: ConfigService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
        const orders = await this.accountService.orderHistory(account.accountId);
        const keyboard = orderHistoryKeyboard(orders);
        const text = 'Имеющиеся заказы на аккаунте:';
        try {
            await ctx.editMessageText(text, keyboard);
        } catch (err) {
            await ctx.reply(text, keyboard);
        }
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @Action(/^order_(\d+)-\d+$/)
    async selectOrder(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
        const account = await this.telegramService.getFromCache(telegramId);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
