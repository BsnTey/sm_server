import { Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { NotFoundException, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { TelegramService } from '../../telegram.service';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME, CHECK } from '../base-command/base-command.constants';
import { CheckingService } from './checking.service';
import { UserService } from '../../../user/user.service';
import { Context } from '../../interfaces/telegram.context';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { ERROR_FOUND_USER } from '../../constants/error.constant';

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
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        await this.userService.createOrUpdateUserByTelegram({
            telegramName,
            telegramId: String(telegramId),
        });

        await ctx.reply('Пришлите номера аккаунтов, каждый с новой строки', getMainMenuKeyboard(user.role));
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputAccounts(@Message('text') inputAccounts: string, @Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        const allAccounts = inputAccounts.split('\n');

        await ctx.reply('Началась проверка');
        const checkedAccounts = await this.checkingService.checkingAccounts(allAccounts);
        const chunks = this.checkingService.toTelegramChunks(checkedAccounts);
        for (let i = 0; i < chunks.length; i++) {
            if (i == chunks.length - 1) {
                await ctx.reply(chunks[i], getMainMenuKeyboard(user.role));
                return;
            }
            await ctx.reply(chunks[i]);
        }
    }
}
