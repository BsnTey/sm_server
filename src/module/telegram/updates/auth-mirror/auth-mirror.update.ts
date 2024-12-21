import { ALL_KEYS_MENU_BUTTON_NAME, AUTH_MIRROR } from '../base-command/base-command.constants';
import { Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { AccountService } from '../../../account/account.service';
import { WizardContext } from 'telegraf/typings/scenes';
import { TelegramService } from '../../telegram.service';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { NotFoundException, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../../user/user.service';
import { ERROR_FOUND_USER } from '../../constants/error.constant';
import { MirrorService } from '../../../mirror/mirror.service';
import { UserRole } from '@prisma/client';

@Scene(AUTH_MIRROR.scene)
@UseFilters(TelegrafExceptionFilter)
export class AuthMirrorUpdate {
    private DOMAIN = this.configService.getOrThrow('DOMAIN', 'http://localhost:3001');

    constructor(
        private accountService: AccountService,
        private userService: UserService,
        private telegramService: TelegramService,
        private configService: ConfigService,
        private mirrorService: MirrorService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId, first_name: telegramName }: any) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        if (user.role != UserRole.Admin) return ctx.reply('🚫 Доступ запрещен');

        const createdMirror = await this.mirrorService.createAccountMirror(String(telegramId), String(telegramName));
        await ctx.reply('Пройдите авторизацию', {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Авторизация',
                            web_app: {
                                url: `${this.DOMAIN}/api/webapp/auth?id=${createdMirror.id}`,
                            },
                        },
                    ],
                ],
            },
        });
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
