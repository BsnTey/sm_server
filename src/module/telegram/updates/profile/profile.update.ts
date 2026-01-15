import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME, PROFILE } from '../base-command/base-command.constants';
import { CheckingService } from '../checking/checking.service';
import { profileKeyboard } from '../../keyboards/profile.keyboard';
import { NotFoundException, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import {
    COURSES_SCENE,
    EXTENSION_SCENE,
    FORTUNE_BOT_SCENE,
    MAKE_DEPOSIT_SCENE,
    MY_DISCOUNT_SCENE,
    PROFILE_GET_INFO_ORDER,
} from '../../scenes/profile.scene-constant';
import { ERROR_FOUND_USER } from '../../constants/error.constant';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { OrderService } from '../../../order/order.service';
import { BaseUpdate } from '../base/base.update';

@Scene(PROFILE.scene)
@UseFilters(TelegrafExceptionFilter)
export class ProfileUpdate extends BaseUpdate {
    constructor(private checkingService: CheckingService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        await ctx.reply('Выберете действие', profileKeyboard(user.role));
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputAccounts(@Message('text') inputAccounts: string, @Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        const allAccounts = inputAccounts.split('\n');

        await ctx.reply('Началась проверка');
        const checkedAccounts = await this.checkingService.checkingAccountsOnPromocodes(allAccounts);
        const chunks = this.checkingService.toTelegramChunks(checkedAccounts);
        for (let i = 0; i < chunks.length; i++) {
            if (i == chunks.length - 1) {
                await ctx.reply(chunks[i], { parse_mode: 'HTML', ...getMainMenuKeyboard(user.role) });
                return;
            }
            await ctx.reply(chunks[i], { parse_mode: 'HTML' });
        }
    }

    @Action('check_promo')
    async goToCheckerPromo(@Ctx() ctx: WizardContext) {
        await ctx.reply('Пришлите номера аккаунтов, каждый с новой строки');
    }

    @Action('check_my_discount')
    async goToCheckerMyDiscount(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(MY_DISCOUNT_SCENE);
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

    @Action('extension')
    async goToExtension(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(EXTENSION_SCENE);
    }

    @Action('get_courses')
    async goToCourses(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(COURSES_SCENE);
    }
}

@Scene(PROFILE_GET_INFO_ORDER)
@UseFilters(TelegrafExceptionFilter)
export class GetInfoOrderUpdate extends BaseUpdate {
    constructor(private orderService: OrderService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply('Введите номер вашего заказа для поиска аккаунта, с которого был выполнен заказ:');
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputAccounts(@Message('text') numberOrder: string, @Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);
        const order = await this.orderService.findOrderNumber(numberOrder);
        if (order) {
            await ctx.reply(order.accountId, getMainMenuKeyboard(user.role));
        } else {
            await ctx.reply('Нет данных о заказе', getMainMenuKeyboard(user.role));
        }
    }
}

// @Scene(PROMOCODE_BOT_SCENE)
// @UseFilters(TelegrafExceptionFilter)
// export class PromocodeBotUpdate extends BaseUpdate {
//     constructor(
//         private paymentService: PaymentService,
//     ) {
// super();
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
//         await this.exitScene(menuBtn, ctx);
//     }
// }
