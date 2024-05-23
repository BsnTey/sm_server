import { Action, Ctx, Hears, Message, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME, PROFILE } from '../base-command/base-command.constants';
import { TelegramService } from '../../telegram.service';
import { AccountService } from '../../../account/account.service';
import { mainMenuKeyboard } from '../../keyboards/base.keyboard';
import { CheckingService } from '../checking/checking.service';
import { profileKeyboard } from '../../keyboards/profile.keyboard';
import { UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { PROFILE_GET_INFO_ORDER } from '../../scenes/profile.scene-constant';

@Scene(PROFILE.scene)
@UseFilters(TelegrafExceptionFilter)
export class ProfileUpdate {
    constructor(
        private telegramService: TelegramService,
        private checkingService: CheckingService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply('Выберете действие', profileKeyboard);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputAccounts(@Message('text') inputAccounts: string, @Ctx() ctx: WizardContext) {
        const accounts = inputAccounts.split('\n');
        await ctx.reply('Началась проверка');
        const checkedAccounts = await this.checkingService.checkingAccountsOnPromocodes(accounts);
        await ctx.reply(checkedAccounts.join(''), mainMenuKeyboard);
    }

    @Action('check_promo')
    async goToCheckerPromo(@Ctx() ctx: WizardContext) {
        await ctx.reply('Пришлите номера аккаунтов, каждый с новой строки', mainMenuKeyboard);
    }

    @Action('get_info_order')
    async getInfoOrder(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(PROFILE_GET_INFO_ORDER);
    }
}

@Scene(PROFILE_GET_INFO_ORDER)
@UseFilters(TelegrafExceptionFilter)
export class GetInfoOrderUpdate {
    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply('Введите номер вашего заказа для поиска аккаунта, с которого был выполнен заказ:', mainMenuKeyboard);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputAccounts(@Message('text') numberOrder: string, @Ctx() ctx: WizardContext) {
        const order = await this.accountService.findOrderNumber(numberOrder);
        if (order) {
            await ctx.reply(order.accountId, mainMenuKeyboard);
        } else {
            await ctx.reply('Нет данных о заказе', mainMenuKeyboard);
        }
    }
}
