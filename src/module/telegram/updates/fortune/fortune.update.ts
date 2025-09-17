import { Action, Ctx, Hears, Message, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { FORTUNE_BOT_SCENE } from '../../scenes/profile.scene-constant';
import { UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { TelegramService } from '../../telegram.service';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME } from '../base-command/base-command.constants';
import { getSurprise } from '../../keyboards/profile.keyboard';
import { FortuneCouponService } from '../../../coupon/fortune-coupon.service';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { SenderTelegram } from '../../interfaces/telegram.context';

@Scene(FORTUNE_BOT_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class FortuneUpdate {
    constructor(
        private telegramService: TelegramService,
        private fortuneCouponService: FortuneCouponService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: SenderTelegram) {
        const prizeToday = await this.fortuneCouponService.getPrizeForToday(String(telegramId));
        if (prizeToday) {
            await ctx.editMessageText('😦 Вы уже получили приз сегодня, приходите за ним завтра.');
        } else {
            const text = 'Жмите на кнопку, забирайте приз! 🥳';
            await ctx.editMessageText(text, getSurprise);
        }
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @Action('get_surprise')
    async getSurprise(@Ctx() ctx: WizardContext, @Sender() sender: SenderTelegram) {
        const prizeToday = await this.fortuneCouponService.getPrizeForToday(String(sender.id));
        if (prizeToday) {
            await ctx.reply('😦 Вы уже получили приз сегодня, приходите за ним завтра.');
            return;
        }
        const prize = this.fortuneCouponService.getRandomPrize(sender);
        const newCoupon = await this.fortuneCouponService.awardPrizeToUser(prize, String(sender.id));

        await ctx.reply(
            `🔥 Поздравляем! Вы выиграли: ${prize.name}.\nДЕЙСТВУЕТ ДО КОНЦА ДНЯ\n(код: <b><code>${newCoupon.coupon}</code></b>)`,
            {
                parse_mode: 'HTML',
                ...getMainMenuKeyboard(),
            },
        );
    }
}
