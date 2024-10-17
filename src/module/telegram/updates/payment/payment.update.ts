import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { BadRequestException, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { ALL_KEYS_MENU_BUTTON_NAME } from '../base-command/base-command.constants';
import { TelegramService } from '../../telegram.service';
import { MAKE_DEPOSIT_SCENE } from '../../scenes/profile.scene-constant';
import { isMoneyAmountPipe } from '../../pipes/isMoneyAmount.pipe';
import { cancelPaymentKeyboard, createdPaymentKeyboard } from '../../keyboards/profile.keyboard';
import { StatusPayment } from '@prisma/client';
import { ERROR_SCRINSHOT } from '../../constants/error.constant';
import { FileService } from '../../../shared/file.service';
import { getFileNameForReceipt } from '../../utils/receipt.utils';
import { extractAmountFTransferedPay } from '../../utils/payment.utils';
import { PaymentService } from '../../../payment/payment.service';

@Scene(MAKE_DEPOSIT_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class PaymentUpdate {
    constructor(
        private telegramService: TelegramService,
        private paymentService: PaymentService,
        private fileService: FileService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const allPayments = await this.paymentService.getUserPaymentOrders(String(telegramId));

        const createdPayments = allPayments.filter(payment => payment.status == StatusPayment.Created);
        const transferedPayments = allPayments.filter(payment => payment.status == StatusPayment.Transfered);
        let text = extractAmountFTransferedPay(transferedPayments);

        if (createdPayments.length == 0) {
            text += 'Для пополнения введите сумму (кратную 50р), на которую хотите пополнить.\nМинимум 500р, от 2000р пополнение +10%';
            await ctx.editMessageText(text);
        } else {
            const keyboard = createdPaymentKeyboard(createdPayments);
            text +=
                'У вас есть незавершенные заявки на пополнение. Выберете одну из них, либо создайте новую, отправив сумму пополнения в бот';
            await ctx.editMessageText(text, keyboard);
        }
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async inputMoneyAmount(
        @Message('text', new isMoneyAmountPipe()) amountCount: number,
        @Ctx() ctx: WizardContext,
        @Sender() { id: telegramId }: any,
    ) {
        const createOrder = await this.paymentService.createPaymentOrder(amountCount, String(telegramId));
        await this.telegramService.setDataCache<string>(String(telegramId), createOrder.id);
        await ctx.reply(
            `Создана заявка на пополнение на сумму ${createOrder.amount}р.\nК зачислению ${createOrder.amountCredited}р\n
Сделайте перевод (${createOrder.amount}р) на реквизиты Админа и пришлите чек о переводе в чат`,
            cancelPaymentKeyboard(createOrder.id),
        );
    }

    @Action('goBack')
    async goBack(@Ctx() ctx: WizardContext) {
        await ctx.scene.reenter();
    }

    @Action(/^cancelPayment_.*$/)
    async cancelPayment(@Ctx() ctx: WizardContext) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const paymentId = ctx.match[0].split('_')[1];

        const orderPayment = await this.paymentService.updatePaymentOrderStatus(paymentId, StatusPayment.Cancelled);

        await ctx.editMessageText(`Заявка на сумму ${orderPayment.amount}р отменена`);
    }

    @Action(/^createdPayment_.*$/)
    async createdPayment(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const paymentInfo = ctx.match[0].split('_')[1];
        const [paymentId, amount, amountCredited] = paymentInfo.split('|');
        await this.telegramService.setDataCache<string>(String(telegramId), paymentId);

        await ctx.editMessageText(
            `Заявка на сумму ${amount}р\nК зачислению ${amountCredited}р\n
Сделайте перевод (${amount}р) на реквизиты Админа и пришлите чек о переводе в чат`,
            cancelPaymentKeyboard(paymentId),
        );
    }

    @On('photo')
    async inputReceipt(@Sender() { id: telegramId }: any, @Ctx() ctx: WizardContext) {
        try {
            const paymentId = await this.telegramService.getDataFromCache<string>(String(telegramId));
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            const photos = ctx!.message!.photo;
            const fileId = photos[photos.length - 2].file_id;
            const fileLink = await ctx.telegram.getFileLink(fileId);

            const fileExtension = fileLink.href.split('.').pop() || 'jpg';
            const fileName = getFileNameForReceipt(String(telegramId), fileExtension);
            await this.fileService.saveFileFromTg(fileName, fileLink);

            const orderPayment = await this.paymentService.makeDepositUserBalance(paymentId, fileName);
            await ctx.reply(`Заявка на сумму ${orderPayment.amountCredited}р исполнена. Квитанция сохранена.`);
            await ctx.scene.leave();
        } catch (error) {
            console.error('Error processing receipt:', error);
            await ctx.reply('Произошла ошибка при обработке квитанции.');
        }
    }

    @On('document')
    async inputReceiptDoc(@Sender() { id: telegramId }: any, @Ctx() ctx: WizardContext) {
        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            const document = ctx.message!.document!;

            if (document?.mime_type === 'application/pdf') {
                const fileLink = await ctx.telegram.getFileLink(document.file_id);
                const pdfBuffer = await this.fileService.downloadFile(fileLink.href);
                const fileName = getFileNameForReceipt(String(telegramId), 'jpg');
                const jpgBuffer = await this.fileService.convertPdfToJpg(pdfBuffer, fileName);

                await this.fileService.saveFile(fileName, jpgBuffer);

                const paymentId = await this.telegramService.getDataFromCache<string>(String(telegramId));
                const orderPayment = await this.paymentService.makeDepositUserBalance(paymentId, fileName);
                await ctx.reply(`Заявка на сумму ${orderPayment.amountCredited}р исполнена. Квитанция сохранена.`);

                await ctx.scene.leave();
            } else {
                await ctx.reply('Пожалуйста, отправьте файл в формате PDF.');
            }
        } catch (error) {
            await ctx.reply('Ошибка при обработке документа квитанции');
        }
    }

    @On('text')
    async ErrorText() {
        throw new BadRequestException(ERROR_SCRINSHOT);
    }
}
