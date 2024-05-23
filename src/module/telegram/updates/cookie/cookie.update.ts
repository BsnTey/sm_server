import { ALL_KEYS_MENU_BUTTON_NAME, COOKIE } from '../base-command/base-command.constants';
import { Ctx, Hears, Message, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { AccountService } from '../../../account/account.service';
import { WizardContext } from 'telegraf/typings/scenes';
import { mainMenuKeyboard } from '../../keyboards/base.keyboard';
import { TelegramService } from '../../telegram.service';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { NotFoundException, UseFilters } from '@nestjs/common';
import { ERROR_ACCOUNT_NOT_FOUND } from '../../../account/constants/error.constant';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';

@Scene(COOKIE.scene)
@UseFilters(TelegrafExceptionFilter)
export class CookieUpdate {
    constructor(
        private accountService: AccountService,
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
    async findAccount(@Message('text', new isAccountIdPipe()) accountId: string, @Ctx() ctx: WizardContext) {
        const account = await this.accountService.getAccountCookie(accountId);
        if (!account) throw new NotFoundException(ERROR_ACCOUNT_NOT_FOUND);
        await ctx.reply(String(account.cookie));
    }
}
