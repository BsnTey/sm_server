import { Ctx, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { START } from '../base-command/base-command.constants';
import { Context } from '../../interfaces/telegram.context';
import { UserService } from '../../../user/user.service';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { NotFoundException } from '@nestjs/common';
import { ERROR_FOUND_USER } from '../../constants/error.constant';

@Scene(START.scene)
export class StartUpdate {
    constructor(private userService: UserService) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context, @Sender() telegramUser: any) {
        const { first_name: telegramName, id: telegramId } = telegramUser;
        await this.userService.createOrUpdateUserByTelegram({
            telegramName,
            telegramId: String(telegramId),
        });
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);
        await ctx.replyWithPhoto('https://cstor.nn2.ru/forum/data/forum/images/2018-04/203019686-3f3b88013d6894fa103d7e79121a346a.jpg', {
            caption: `Добро пожаловать в меню, ${telegramName}!\n\nЧто вас интересует?`,
            ...getMainMenuKeyboard(user.role),
        });

        await ctx.scene.leave();
    }
}
