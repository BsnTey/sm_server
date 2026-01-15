import { ALL_KEYS_MENU_BUTTON_NAME, AUTH_MIRROR } from '../base-command/base-command.constants';
import { Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { NotFoundException, OnModuleInit, UseFilters, UseGuards } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { ERROR_FOUND_USER } from '../../constants/error.constant';
import { MirrorService } from '../../../mirror/mirror.service';
import { SellerGuard } from './seller.guard';
import { BaseUpdate } from '../base/base.update';

@Scene(AUTH_MIRROR.scene)
@UseFilters(TelegrafExceptionFilter)
export class AuthMirrorUpdate extends BaseUpdate implements OnModuleInit {
    private DOMAIN: string;

    constructor(private mirrorService: MirrorService) {
        super();
    }

    onModuleInit() {
        this.DOMAIN = this.configService.getOrThrow('DOMAIN');
    }

    @SceneEnter()
    @UseGuards(SellerGuard)
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId, first_name: telegramName }: any) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

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
        await this.exitScene(menuBtn, ctx);
    }

    @On('text')
    async findAccount(@Message('text', new isAccountIdPipe()) accountId: string, @Ctx() ctx: WizardContext) {
        await ctx.reply('Используйте авторизацию по кнопке ⬆️');
        await ctx.scene.leave();
    }
}
