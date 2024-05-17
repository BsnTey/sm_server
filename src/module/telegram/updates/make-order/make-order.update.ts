import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { ALL_KEYS_MENU_BUTTON_NAME, MAKE_ORDER } from '../base-command/base-command.constants';
import { UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { TelegramService } from '../../telegram.service';
import { WizardContext } from 'telegraf/typings/scenes';
import { mainMenuKeyboard } from '../../keyboards/base.keyboard';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import {
    ORDER_CITY_SCENE,
    ORDER_FAVOURITE_CITY_SCENE,
    ORDER_GET_ORDERS_SCENE,
    ORDER_MENU_ACCOUNT_SCENE,
    ORDER_MENU_CART_SCENE,
} from '../../scenes/make-order.scene-constant';
import { AccountService } from '../../../account/account.service';
import {
    comebackOrderCityScene,
    getCitiesForDeleteKeyboard,
    getCitiesKeyboard,
    getFoundedCitiesForFavKeyboard,
    getUserCitiesKeyboard,
    mainMenuOrderKeyboard,
} from './keyboards/make-order.keyboard';
import { UserService } from '../../../user/user.service';
import { isCityPipe } from '../../pipes/isCity.pipe';
import { ERROR_FIND_CITY } from '../../constants/error.constant';

@Scene(MAKE_ORDER.scene)
@UseFilters(TelegrafExceptionFilter)
export class MakeOrderUpdate {
    constructor(private telegramService: TelegramService) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
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
export class OrderFavouriteCity {
    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
        private userService: UserService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.editMessageText('Введите название города для добавления в избранное', comebackOrderCityScene);
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
