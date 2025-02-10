import { Action, Ctx, Hears, Message, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { FORTUNE_BOT_SCENE } from '../../scenes/profile.scene-constant';
import { UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { TelegramService } from '../../telegram.service';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME } from '../base-command/base-command.constants';
import { getSurprise } from '../../keyboards/profile.keyboard';

@Scene(FORTUNE_BOT_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class FortuneUpdate {
    constructor(private telegramService: TelegramService) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const text = 'Жмите на кнопку, забирайте приз!';
        await ctx.editMessageText(text, getSurprise);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @Action('get_surprise')
    async getSurprise(@Ctx() ctx: WizardContext) {}
}
