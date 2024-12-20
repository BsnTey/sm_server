import { ALL_KEYS_MENU_BUTTON_NAME, AUTH_MIRROR } from '../base-command/base-command.constants';
import { Ctx, Hears, Message, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { AccountService } from '../../../account/account.service';
import { WizardContext } from 'telegraf/typings/scenes';
import { TelegramService } from '../../telegram.service';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { ConfigService } from '@nestjs/config';

@Scene(AUTH_MIRROR.scene)
@UseFilters(TelegrafExceptionFilter)
export class AuthMirrorUpdate {
    private DOMAIN = this.configService.getOrThrow('DOMAIN', 'http://localhost:3001');

    private userIpMap: Record<string, string> = {};

    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
        private configService: ConfigService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply('Пройдите авторизацию', {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Авторизация',
                            web_app: {
                                url: `${this.DOMAIN}/api/webapp/auth`,
                            },
                        },
                    ],
                ],
            },
        });
    }

    getUserIp(telegramId: string): string | null {
        return this.userIpMap[telegramId] || null;
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async findAccount(@Message('text', new isAccountIdPipe()) accountId: string, @Ctx() ctx: WizardContext) {
        await this.accountService.getAccount(accountId);
        const url = `${this.DOMAIN}/api/mirror/${accountId}`;

        await ctx.reply(url, {
            parse_mode: 'Markdown',
        });
    }
}
