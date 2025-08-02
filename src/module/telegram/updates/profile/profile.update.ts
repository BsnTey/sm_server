import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME, PROFILE } from '../base-command/base-command.constants';
import { TelegramService } from '../../telegram.service';
import { AccountService } from '../../../account/account.service';
import { CheckingService } from '../checking/checking.service';
import { profileKeyboard } from '../../keyboards/profile.keyboard';
import { NotFoundException, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { FORTUNE_BOT_SCENE, MAKE_DEPOSIT_SCENE, PROFILE_GET_INFO_ORDER } from '../../scenes/profile.scene-constant';
import { UserService } from '../../../user/user.service';
import { ERROR_FOUND_USER } from '../../constants/error.constant';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';

@Scene(PROFILE.scene)
@UseFilters(TelegrafExceptionFilter)
export class ProfileUpdate {
    constructor(
        private telegramService: TelegramService,
        private checkingService: CheckingService,
        private userService: UserService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);
        await ctx.reply('Выберете действие', profileKeyboard(user.role));
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputAccounts(@Message('text') inputAccounts: string, @Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        const allAccounts = inputAccounts.split('\n');
        const accounts = allAccounts.slice(0, 22);
        const extraAccounts = allAccounts.slice(22);

        if (extraAccounts.length > 0) {
            await ctx.reply(`Не вместилось, отправьте еще раз:\n${extraAccounts.join('\n')}`);
        }
        await ctx.reply('Началась проверка');
        const checkedAccounts = await this.checkingService.checkingAccountsOnPromocodes(accounts);
        await ctx.reply(checkedAccounts.join(''), { parse_mode: 'HTML', ...getMainMenuKeyboard(user.role) });
    }

    @Action('check_promo')
    async goToCheckerPromo(@Ctx() ctx: WizardContext) {
        await ctx.reply('Пришлите номера аккаунтов, каждый с новой строки. За раз не больше 20');
    }

    @Action('get_info_order')
    async getInfoOrder(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(PROFILE_GET_INFO_ORDER);
    }

    @Action('payment')
    async makeDeposit(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(MAKE_DEPOSIT_SCENE);
    }

    // @Action('get_promocode')
    // async getPromocode(@Ctx() ctx: WizardContext) {
    //     await ctx.scene.enter(PROMOCODE_BOT_SCENE);
    // }

    @Action('fortune')
    async goToFortune(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(FORTUNE_BOT_SCENE);
    }
}

@Scene(PROFILE_GET_INFO_ORDER)
@UseFilters(TelegrafExceptionFilter)
export class GetInfoOrderUpdate {
    constructor(
        private accountService: AccountService,
        private userService: UserService,
        private telegramService: TelegramService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply('Введите номер вашего заказа для поиска аккаунта, с которого был выполнен заказ:');
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputAccounts(@Message('text') numberOrder: string, @Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);
        const order = await this.accountService.findOrderNumber(numberOrder);
        if (order) {
            await ctx.reply(order.accountId, getMainMenuKeyboard(user.role));
        } else {
            await ctx.reply('Нет данных о заказе', getMainMenuKeyboard(user.role));
        }
    }
}

// @Scene(PROMOCODE_BOT_SCENE)
// @UseFilters(TelegrafExceptionFilter)
// export class PromocodeBotUpdate {
//     constructor(
//         private telegramService: TelegramService,
//         private paymentService: PaymentService,
//         private userService: UserService,
//     ) {
//     }
//
//     @SceneEnter()
//     async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId, username }: any) {
//         const remainingActivations = await this.paymentService.findRemainingActivations(String(telegramId), username);
//         if (remainingActivations) {
//             await ctx.editMessageText(
//                 `У вас еще осталось (${remainingActivations.activationsLeft}) активации промокода <b><code>${username}</code></b> на ${remainingActivations.discount}% скидки`,
//                 { parse_mode: 'HTML', ...comebackProfile },
//             );
//         } else {
//             const avaliblePromocode = await this.paymentService.getInfoAboutPromocode(String(telegramId), username);
//
//             await ctx.editMessageText(`Вы можете выпустить промокод на скидку ${avaliblePromocode}%`, createPromocodeScene);
//         }
//     }
//
//     @Action('comeback_profile')
//     async getInfoOrder(@Ctx() ctx: WizardContext) {
//         await ctx.deleteMessage();
//         await ctx.scene.enter(PROFILE.scene);
//     }
//
//     @Action('create_promocode')
//     async createPromocode(@Ctx() ctx: WizardContext, @Sender() { id: telegramId, username }: any) {
//         const { promoName, discountPercent } = await this.paymentService.createPromocode(String(telegramId), username);
//         const user = await this.userService.getUserByTelegramId(String(telegramId));
//         if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);
//         await ctx.reply(
//             `Ваш промокод <b><code>${promoName}</code></b> на ${discountPercent}% скидку создан. Всего активаций: 5 для перевыпуска`,
//             { parse_mode: 'HTML', ...getMainMenuKeyboard(user.role) },
//         );
//         await ctx.scene.leave();
//     }
//
//     @Hears(ALL_KEYS_MENU_BUTTON_NAME)
//     async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
//         await this.telegramService.exitScene(menuBtn, ctx);
//     }
// }
