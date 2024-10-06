import { PaymentOrderEntity } from '../../bott/entities/payment.entities';
import dayjs from 'dayjs';

export const extractCsrf = (html: string) => {
    const csrfRegex = /<meta name="csrf-token" content="([^"]+)">/;
    const match = html.match(csrfRegex);

    if (!match || !match[1]) {
        throw new Error('CSRF-токен не найден');
    }

    return match[1];
};

export const extractUserBotId = (html: string) => {
    const userBotIdRegex = /data-key="([\w\W]*?)">/;
    const match = html.match(userBotIdRegex);

    if (!match || !match[1]) {
        throw new Error('UserBotId не найден');
    }

    return match[1];
};

export const extractAmountFTransferedPay = (payments: PaymentOrderEntity[]) => {
    if (payments.length == 0) return '';
    let text = 'Суммы не подтверждены админом:\n';
    payments.forEach(pay => (text += pay.amountCredited + ` от ${dayjs(pay.completedAt).format('DD-MM-YYYY  HH:mm')}` + '\n'));
    return text;
};
