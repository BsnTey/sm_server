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
import { BottService } from '../../../bott/bott.service';
import { FileService } from '../../../shared/file.service';
import { getFileNameReceipt } from '../../utils/receipt.utils';
import { extractAmountFTransferedPay } from '../../utils/payment.utils';

@Scene(MAKE_DEPOSIT_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class PaymentUpdate {
    constructor(
        private telegramService: TelegramService,
        private bottService: BottService,
        private fileService: FileService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const allPayments = await this.bottService.getUserPaymentOrders(String(telegramId));

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
        const createOrder = await this.bottService.createPaymentOrder(amountCount, String(telegramId));
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

        const orderPayment = await this.bottService.updatePaymentOrderStatus(paymentId, StatusPayment.Cancelled);

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

            const { fileName, fileLink } = await getFileNameReceipt(ctx);
            await this.fileService.saveFileFromTg(fileName, fileLink);

            const orderPayment = await this.bottService.makeDepositUserBalance(paymentId, fileName);
            await ctx.reply(`Заявка на сумму ${orderPayment.amountCredited}р исполнена. Квитанция сохранена.`);
            await ctx.scene.leave();
        } catch (error) {
            console.error('Error processing receipt:', error);
            await ctx.reply('Произошла ошибка при обработке квитанции.');
        }
    }

    @On('document')
    async inputReceiptDoc(@Sender() { id: telegramId }: any, @Ctx() ctx: WizardContext) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const document = ctx.message!.document!;

        if (document?.mime_type !== 'application/pdf') {
            await ctx.reply('Пожалуйста, отправьте файл в формате скриншота чека или файл PDF из приложения банка.');
            return;
        }

        const paymentId = await this.telegramService.getDataFromCache<string>(String(telegramId));
        const orderPayment = await this.bottService.updatePaymentOrderStatus(paymentId, StatusPayment.Transfered);
        await ctx.reply(`Заявка на сумму ${orderPayment.amount}р исполнена`);
    }

    @On('text')
    async ErrorText() {
        throw new BadRequestException(ERROR_SCRINSHOT);
    }
}
