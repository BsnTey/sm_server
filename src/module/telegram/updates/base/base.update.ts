import { Ctx, Hears, Message } from 'nestjs-telegraf';
import { ALL_KEYS_MENU_BUTTON_NAME } from '../base-command/base-command.constants';
import { TelegramService } from '../../telegram.service';
import { WizardContext } from 'telegraf/typings/scenes';
import { NotFoundException } from '@nestjs/common';
import { ERROR_FOUND_USER } from '../../constants/error.constant';
import { UserService } from '../../../user/user.service';

export class BaseUpdate {
    constructor(
        private telegramService: TelegramService,
        private userService: UserService,
    ) {}

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    async upsertUserTelegram(telegramName: string, telegramId: number | string) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        await this.userService.createOrUpdateUserByTelegram({
            telegramName,
            telegramId: String(telegramId),
        });

        return user;
    }
}
