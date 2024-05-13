import { Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME, CHANGE_NUMBER } from '../base-command/base-command.constants';
import { Inject, UseFilters } from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { AccountService } from '../../../account/account.service';
import { mainMenuKeyboard } from '../../keyboards/base.keyboard';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { CHANGE_NUMBER_INPUT_NUMBER_SCENE } from '../../scenes/change-number.scene.constants';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { TelegramService } from '../../telegram.service';

@Scene(CHANGE_NUMBER.scene)
@UseFilters(TelegrafExceptionFilter)
export class ChangeNumberUpdate {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private telegramService: TelegramService,
    ) {}

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
        await this.telegramService.setCache(telegramId, accountId);
        await ctx.scene.enter(CHANGE_NUMBER_INPUT_NUMBER_SCENE);
    }
}

@Scene(CHANGE_NUMBER_INPUT_NUMBER_SCENE)
export class ChangeNumberInputNumber {
    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);

        const shortInfo = await this.accountService.shortInfo(account.accountId);
        const text = `📱 Аккаунт найден. Баланс: ${shortInfo.bonusCount}.\nВведите номер телефона, на который хотите перепривязать его`;
        await ctx.reply(text);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }
    //
    // @On('text')
    // async inputPhoneNumber(@Ctx() ctx: WizardContext) {
    //     const api = ctx.session['api'];
    //     const phoneNumber = ctx.message['text'];
    //     const requestId = await this.changeNumberService.sendSms(api, phoneNumber);
    //     ctx.session['requestId'] = requestId;
    //
    //     await ctx.scene.enter(CHANGE_NUMBER_CODE_SCENE);
    // }
}
//
// @Scene(CHANGE_NUMBER_CODE_SCENE)
// export class ChangeNumberInputCode {
//     constructor(private changeNumberService: ChangeNumberService) {}
//
//     @SceneEnter()
//     async onSceneEnter(@Ctx() ctx: WizardContext) {
//         await ctx.reply(
//             'Код выслан на указанный номер. Отправьте его в чат. Если код не пришел, то проблема в номере, используйте другой, ранее не использованный в Спортмастер. У вас есть 3 попытки отправки кода в день',
//         );
//     }
//
//     @Hears(ALL_KEYS_MENU_BUTTON_NAME)
//     async exit(@Ctx() ctx: WizardContext) {
//         await ctx.scene.leave();
//         const text = ctx.message['text'];
//         await ctx.scene.enter(getValueKeysMenu(text));
//     }
//
//     @On('text')
//     async inputCodePhoneNumber(@Ctx() ctx: WizardContext) {
//         const code = ctx.message['text'];
//         const api = ctx.session['api'];
//         const requestId = ctx.session['requestId'];
//         await this.changeNumberService.phoneChange(api, requestId, code);
//         await ctx.reply('✅ Номер успешно изменен. Можете авторизовываться в аккаунт', getMainMenu());
//     }
// }
