import { Ctx, Hears, Message, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { ALL_KEYS_MENU_BUTTON_NAME, START } from '../base-command/base-command.constants';
import { Context, SenderTelegram } from '../../interfaces/telegram.context';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { BaseUpdate } from '../base/base.update';
import { WizardContext } from 'telegraf/typings/scenes';

@Scene(START.scene)
export class StartUpdate extends BaseUpdate {
    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        const user = await this.createOrUpdateUserTelegram(sender.first_name, sender.id);
        await ctx.replyWithPhoto('https://cstor.nn2.ru/forum/data/forum/images/2018-04/203019686-3f3b88013d6894fa103d7e79121a346a.jpg', {
            caption: `Добро пожаловать в меню, ${sender.first_name}!\n\nЧто вас интересует?`,
            ...getMainMenuKeyboard(user.role),
        });

        await ctx.scene.leave();
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }
}
