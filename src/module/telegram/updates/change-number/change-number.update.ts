import { Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME, CHANGE_NUMBER } from '../base-command/base-command.constants';
import { NotFoundException, UseFilters } from '@nestjs/common';
import { AccountService } from '../../../account/account.service';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { CHANGE_NUMBER_CODE_SCENE, CHANGE_NUMBER_INPUT_NUMBER_SCENE } from '../../scenes/change-number.scene-constants';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { TelegramService } from '../../telegram.service';
import { isPhonePipe } from '../../pipes/isPhone.pipe';
import { isCodePipe } from '../../pipes/isCode.pipe';
import { Context } from '../../interfaces/telegram.context';
import { UserService } from '../../../user/user.service';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { ERROR_FOUND_USER } from '../../constants/error.constant';

@Scene(CHANGE_NUMBER.scene)
@UseFilters(TelegrafExceptionFilter)
export class ChangeNumberUpdate {
    constructor(
        private telegramService: TelegramService,
        private userService: UserService,
    ) {}

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
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async findAccount(
        @Message('text', new isAccountIdPipe()) accountId: string,
        @Sender() { id: telegramId }: any,
        @Ctx() ctx: WizardContext,
    ) {
        await this.telegramService.setTelegramAccountCache(telegramId, accountId);
        await ctx.scene.enter(CHANGE_NUMBER_INPUT_NUMBER_SCENE);
    }
}

@Scene(CHANGE_NUMBER_INPUT_NUMBER_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class ChangeNumberInputNumber {
    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(String(telegramId));

        const shortInfo = await this.accountService.shortInfo(account.accountId);
        const text = `📱 Аккаунт найден. Баланс: ${shortInfo.bonusCount}.\nВведите номер телефона, на который хотите перепривязать его`;
        await ctx.reply(text);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputPhoneNumber(
        @Message('text', new isPhonePipe()) phoneNumber: string,
        @Ctx() ctx: WizardContext,
        @Sender() { id: telegramId }: any,
    ) {
        const account = await this.telegramService.getFromCache(String(telegramId));
        account.requestId = await this.accountService.sendSmsWithAnalytics(account.accountId, phoneNumber);
        await ctx.scene.enter(CHANGE_NUMBER_CODE_SCENE);
    }
}

@Scene(CHANGE_NUMBER_CODE_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class ChangeNumberInputCode {
    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
        private userService: UserService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply(
            'Код выслан на указанный номер. Отправьте его в чат. Если код не пришел, то проблема в номере, используйте другой, ранее не использованный в Спортмастер. У вас есть 3 попытки отправки кода в день',
        );
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputCodePhoneNumber(
        @Message('text', new isCodePipe()) code: string,
        @Ctx() ctx: WizardContext,
        @Sender() { id: telegramId }: any,
    ) {
        const account = await this.telegramService.getFromCache(String(telegramId));
        await this.accountService.phoneChange(account.accountId, account.requestId, code);
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);
        await ctx.reply('✅ Номер успешно изменен. Можете авторизоваться в аккаунт', getMainMenuKeyboard(user.role));
        await ctx.scene.leave();
    }
}
