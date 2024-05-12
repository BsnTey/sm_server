import { Ctx, Hears, Message, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME, CHANGE_NUMBER } from '../base-command/base-command.constants';
import { Inject, UseFilters } from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { AccountService } from '../../../account/account.service';
import { mainMenuKeyboard } from '../keyboards/base.keyboard';
import { BaseUpdate } from '../base-command/base-command.update';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';

@Scene(CHANGE_NUMBER.scene)
@UseFilters(TelegrafExceptionFilter)
export class ChangeNumberUpdate {
    constructor(
        private accountService: AccountService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await this.cacheManager.set('first', 'first test cahsing');
        await ctx.reply('🔑 Введите номер вашего аккаунта:', mainMenuKeyboard);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await ctx.scene.leave();
        await BaseUpdate.exitScene(menuBtn, ctx);
    }

    @On('text')
    async findAccount(@Message('text', new isAccountIdPipe()) accountId: string, @Ctx() ctx: WizardContext) {
        // const value = await this.cacheManager.get<string>('second');
        // 1. Получаем из кэша апи
        // 1.1 Если апи нет
        // 2.
        // 3.
        // 4.
        // try {
        //     const api = await this.accountService.getApi(accountId, 'shortInfo');
        //     ctx.session['api'] = api;
        //     await ctx.scene.enter(CHANGE_NUMBER_INPUT_NUMBER_SCENE);
        // } catch (error) {
        //     if (Object.keys(KNOWN_ERROR).includes(error.message)) throw new TelegrafException(KNOWN_ERROR[error.message].messageTg);
        //     throw new TelegrafException(error);
        // }
    }
}

// @Scene(CHANGE_NUMBER_INPUT_NUMBER_SCENE)
// export class ChangeNumberInputNumber {
//     constructor(private changeNumberService: ChangeNumberService) {}
//
//     @SceneEnter()
//     async onSceneEnter(@Ctx() ctx: WizardContext) {
//         const api = ctx.session['api'];
//         const text = `📱 Аккаунт найден. Баланс: ${api.bonusCount}.\nВведите номер телефона, на который хотите перепривязать его`;
//         await ctx.reply(text);
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
//     async inputPhoneNumber(@Ctx() ctx: WizardContext) {
//         const api = ctx.session['api'];
//         const phoneNumber = ctx.message['text'];
//         const requestId = await this.changeNumberService.sendSms(api, phoneNumber);
//         ctx.session['requestId'] = requestId;
//
//         await ctx.scene.enter(CHANGE_NUMBER_CODE_SCENE);
//     }
// }
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
