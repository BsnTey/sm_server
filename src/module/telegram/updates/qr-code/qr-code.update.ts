import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME, QR_CODE } from '../base-command/base-command.constants';
import { AccountService } from '../../../account/account.service';
import { NotFoundException, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { QrCodeService } from './qr-code.service';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { qrCodeUpdateKeyboard } from '../../keyboards/qr-code.keyboard';
import { ERROR_FOUND_USER } from '../../constants/error.constant';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { BaseUpdate } from '../base/base.update';

const QR_TTL = 1000;

@Scene(QR_CODE.scene)
@UseFilters(TelegrafExceptionFilter)
export class QrCodeUpdate extends BaseUpdate {
    constructor(
        private qrCodeService: QrCodeService,
        private accountService: AccountService,
    ) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);
        await ctx.reply('🔑 Введите номер вашего аккаунта:', getMainMenuKeyboard(user.role));
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @On('text')
    async findAccount(
        @Message('text', new isAccountIdPipe()) accountId: string,
        @Sender() { id: telegramId }: any,
        @Ctx() ctx: WizardContext,
    ) {
        await this.cacheService.set(`qr_acc:${telegramId}`, { accountId }, QR_TTL);
        const { qrCode, bonusCount } = await this.accountService.shortInfo(accountId);

        const qrCodeBuff = await this.qrCodeService.generateQrCode(qrCode);
        const text = `📱 Аккаунт найден. Баланс: ${bonusCount}`;

        await ctx.replyWithPhoto({ source: qrCodeBuff }, { caption: text, ...qrCodeUpdateKeyboard });
    }

    @Action('update_qrcode')
    async updateQrCode(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const account = await this.cacheService.get<{ accountId: string }>(`qr_acc:${telegramId}`);
        if (!account) return ctx.reply('Сессия истекла.');

        const { qrCode } = await this.accountService.shortInfo(account.accountId);
        const qrCodeBuff = await this.qrCodeService.generateQrCode(qrCode);
        const keyboard = qrCodeUpdateKeyboard.reply_markup;
        try {
            await ctx.editMessageMedia({ type: 'photo', media: { source: qrCodeBuff } }, { reply_markup: keyboard });
        } catch {
            await ctx.reply('Не обновлено. Старый QR активен');
        }
    }
}
