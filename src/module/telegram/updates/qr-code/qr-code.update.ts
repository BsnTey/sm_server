import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME, QR_CODE } from '../base-command/base-command.constants';
import { mainMenuKeyboard } from '../../keyboards/base.keyboard';
import { AccountService } from '../../../account/account.service';
import { UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { QrCodeService } from './qr-code.service';
import { TelegramService } from '../../telegram.service';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { qrCodeUpdateKeyboard } from '../../keyboards/qr-code.keyboard';

@Scene(QR_CODE.scene)
@UseFilters(TelegrafExceptionFilter)
export class QrCodeUpdate {
    constructor(
        private qrCodeService: QrCodeService,
        private accountService: AccountService,
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
    async findAccount(
        @Message('text', new isAccountIdPipe()) accountId: string,
        @Sender() { id: telegramId }: any,
        @Ctx() ctx: WizardContext,
    ) {
        await this.telegramService.setTelegramAccountCache(telegramId, accountId);
        const { qrCode, bonusCount } = await this.accountService.shortInfo(accountId);

        const qrCodeBuff = await this.qrCodeService.generateQrCode(qrCode);
        const text = `📱 Аккаунт найден. Баланс: ${bonusCount}`;

        await ctx.replyWithPhoto({ source: qrCodeBuff }, { caption: text, ...qrCodeUpdateKeyboard });
    }

    @Action('update_qrcode')
    async updateQrCode(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.telegramService.getFromCache(telegramId);
        const { qrCode } = await this.accountService.shortInfo(account.accountId);
        const qrCodeBuff = await this.qrCodeService.generateQrCode(qrCode);
        const keyboard = qrCodeUpdateKeyboard.reply_markup;

        await ctx.editMessageMedia({ type: 'photo', media: { source: qrCodeBuff } }, { reply_markup: keyboard });
    }
}
