import { Ctx, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { FAMILY } from '../base-command/base-command.constants';
import { UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { Context, SenderTelegram } from '../../interfaces/telegram.context';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { BaseUpdate } from '../base/base.update';

@Scene(FAMILY.scene)
@UseFilters(TelegrafExceptionFilter)
export class FamilyUpdate extends BaseUpdate {
    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        const user = await this.upsertUserTelegram(sender.first_name, sender.id);

        await ctx.reply('🔑 Введите номер вашего аккаунта:', getMainMenuKeyboard(user.role));
    }
}
