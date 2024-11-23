import { Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { TelegramService } from '../../telegram.service';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME, CHECK } from '../base-command/base-command.constants';
import { CheckingService } from './checking.service';
import { mainMenuKeyboard } from '../../keyboards/base.keyboard';
import { UserService } from '../../../user/user.service';
import { Context } from '../../interfaces/telegram.context';

@Scene(CHECK.scene)
@UseFilters(TelegrafExceptionFilter)
export class CheckingUpdate {
    constructor(
        private checkingService: CheckingService,
        private telegramService: TelegramService,
        private userService: UserService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context, @Sender() telegramUser: any) {
        // в будующем удалить регу или обновление юзера
        const { first_name: telegramName, id: telegramId } = telegramUser;

        await this.userService.createOrUpdateUserByTelegram({
            telegramName,
            telegramId: String(telegramId),
        });

        await ctx.reply('Пришлите номера аккаунтов, каждый с новой строки. За раз не больше 20', mainMenuKeyboard);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputAccounts(@Message('text') inputAccounts: string, @Ctx() ctx: WizardContext) {
        const accounts = inputAccounts.split('\n');
        await ctx.reply('Началась проверка');
        const checkedAccounts = await this.checkingService.checkingAccounts(accounts);
        await ctx.reply(checkedAccounts.join(''), mainMenuKeyboard);
    }
}
