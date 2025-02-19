import { ALL_KEYS_MENU_BUTTON_NAME, COOKIE } from '../base-command/base-command.constants';
import { Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { AccountService } from '../../../account/account.service';
import { WizardContext } from 'telegraf/typings/scenes';
import { TelegramService } from '../../telegram.service';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { NotFoundException, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { UserService } from '../../../user/user.service';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { ERROR_FOUND_USER } from '../../constants/error.constant';

@Scene(COOKIE.scene)
@UseFilters(TelegrafExceptionFilter)
export class CookieUpdate {
    constructor(
        private accountService: AccountService,
        private userService: UserService,
        private telegramService: TelegramService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);
        await ctx.reply('🔑 Введите номер вашего аккаунта:', getMainMenuKeyboard(user.role));
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async findAccount(@Message('text', new isAccountIdPipe()) accountId: string, @Ctx() ctx: WizardContext) {
        const account = await this.accountService.getAccount(accountId);
        await ctx.reply(account.get3BaseCookie());
    }
}
