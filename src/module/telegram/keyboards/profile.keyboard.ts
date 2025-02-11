import { Markup } from 'telegraf';
import { PaymentOrderEntity } from '../../payment/entities/payment.entities';
import { UserRole } from '@prisma/client';

export const profileKeyboard = (role: UserRole) => {
    const btnArr: any[] = [];
    role != 'User' ? btnArr.push([Markup.button.callback('Пополнить баланс', 'payment')]) : null;
    role != 'User' ? btnArr.push([Markup.button.callback('Призы фортуны', 'fortune')]) : null;
    role != 'User' ? btnArr.push([Markup.button.callback('Получить промокод для бота продаж', 'get_promocode')]) : null;
    btnArr.push([Markup.button.callback('Чекер промо', 'check_promo')]);
    btnArr.push([Markup.button.callback('Получить инфо по заказу', 'get_info_order')]);
    return Markup.inlineKeyboard(btnArr);
};

export function cancelPaymentKeyboard(idPayment: string) {
    return Markup.inlineKeyboard([
        [Markup.button.callback(`Ввести купон`, `payment_coupon`)],
        [Markup.button.callback(`Отменить заявку`, `cancelPayment_${idPayment}`)],
        [Markup.button.callback(`Назад`, 'goBack')],
    ]);
}

export function createdPaymentKeyboard(payments: PaymentOrderEntity[]) {
    const keyboardPay = payments.map(pay => [
        Markup.button.callback(`Заявка на сумму ${pay.amount}`, `createdPayment_${pay.id}|${pay.amount}|${pay.amountCredited}`),
    ]);

    return Markup.inlineKeyboard([...keyboardPay]);
}

export const comebackProfile = Markup.inlineKeyboard([[Markup.button.callback('Назад', 'comeback_profile')]]);
export const comebackPayment = Markup.inlineKeyboard([[Markup.button.callback('Назад', 'comeback_payment')]]);

export const createPromocodeScene = Markup.inlineKeyboard([
    [Markup.button.callback('Выпустить промо', 'create_promocode')],
    [Markup.button.callback(`Назад`, 'comeback_profile')],
]);

export const getSurprise = Markup.inlineKeyboard([[Markup.button.callback('Мне повезет', 'get_surprise')]]);
