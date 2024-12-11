import { Ctx, Hears, Message, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { NotFoundException, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { ALL_KEYS_MENU_BUTTON_NAME, CASH_RECEIPT } from '../base-command/base-command.constants';
import { mainMenuKeyboard } from '../../keyboards/base.keyboard';
import { EmailService } from './email.service';
import { AccountService } from '../../../account/account.service';
import { TelegramService } from '../../telegram.service';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { ERROR_ACCOUNT_NOT_FOUND } from '../../../account/constants/error.constant';

@Scene(CASH_RECEIPT.scene)
@UseFilters(TelegrafExceptionFilter)
export class EmailUpdate {
    constructor(
        private accountService: AccountService,
        private emailService: EmailService,
        private telegramService: TelegramService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply('🔑 Введите номер вашего аккаунта:', mainMenuKeyboard);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async findAccount(@Message('text', new isAccountIdPipe()) accountId: string, @Ctx() ctx: WizardContext) {
        const account = await this.accountService.findAccountEmail(accountId);
        if (!account) throw new NotFoundException(ERROR_ACCOUNT_NOT_FOUND);

        await ctx.reply('Начался поиск, подождите');

        const cashReceipt = await this.emailService.findEmailCashReceipt(account.email, account.passImap);

        if (cashReceipt.length == 0) {
            await ctx.reply('❌ Чеков не найдено');
        }

        for (const subject of cashReceipt) {
            for (const receipt of subject.links) {
                await ctx.reply(receipt);
            }
        }
    }
}
