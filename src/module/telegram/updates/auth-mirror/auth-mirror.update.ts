import { ALL_KEYS_MENU_BUTTON_NAME, AUTH_MIRROR } from '../base-command/base-command.constants';
import { Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { AccountService } from '../../../account/account.service';
import { WizardContext } from 'telegraf/typings/scenes';
import { mainMenuKeyboard } from '../../keyboards/base.keyboard';
import { TelegramService } from '../../telegram.service';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { ConfigService } from '@nestjs/config';

@Scene(AUTH_MIRROR.scene)
@UseFilters(TelegrafExceptionFilter)
export class AuthMirrorUpdate {
    private DOMAIN = this.configService.getOrThrow('DOMAIN', 'http://localhost:3001');

    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
        private configService: ConfigService,
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
    async findAccount(@Message('text', new isAccountIdPipe()) accountId: string, @Ctx() ctx: WizardContext, @Sender() telegramUser: any) {
        const { first_name: telegramName } = telegramUser;
        console.log('Запрос зеркала', telegramName, '   Аккаунт: ', accountId);
        await this.accountService.getAccount(accountId);
        const url = `${this.DOMAIN}/api/mirror/${accountId}`;

        await ctx.reply(url, {
            parse_mode: 'Markdown',
        });
    }
}
