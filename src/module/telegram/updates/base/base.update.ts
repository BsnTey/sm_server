import { Ctx, Hears, Message } from 'nestjs-telegraf';
import { ALL_KEYS_MENU_BUTTON_NAME } from '../base-command/base-command.constants';
import { TelegramService } from '../../telegram.service';
import { WizardContext } from 'telegraf/typings/scenes';
import { UserService } from '../../../user/user.service';
import { Inject } from '@nestjs/common';

export class BaseUpdate {
    @Inject(TelegramService)
    protected telegramService!: TelegramService;

    @Inject(UserService)
    protected userService!: UserService;

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    async createOrUpdateUserTelegram(telegramName: string, telegramId: number | string) {
        return this.userService.createOrUpdateUserByTelegram({
            telegramName,
            telegramId: String(telegramId),
        });
    }
}
