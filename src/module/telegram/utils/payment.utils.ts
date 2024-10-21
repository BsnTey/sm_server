import { PaymentOrderEntity } from '../../payment/entities/payment.entities';
import dayjs from 'dayjs';
import { USerPromocodeActivations, UserStatistic } from '../../payment/interfaces/statistic.interface';

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

export const extractUsersStatistics = (html: string): UserStatistic[] => {
    const regex =
        /<th scope="row">(\d+)<\/th>\s*<td>(?:<a href="tg:\/\/user\?id=(\d+)">([^<]+)<\/a>|(@[\w_]+))<\/td>\s*<td>([\d\s]+) ₽<\/td>/g;
    const usersStatistics: Array<UserStatistic> = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null) {
        const row = parseInt(match[1], 10);
        const tgId = match[2] || null;
        const name = match[3] ? match[3].trim() : match[4].trim().replace(/^@/, '');

        usersStatistics.push({ row, name, tgId });
    }

    if (usersStatistics.length === 0) {
        throw new Error('Статистика пользователей не найдена');
    }

    return usersStatistics;
};

export const getPromoCodeDetailsFromHtml = (html: string, promoCodeName: string): USerPromocodeActivations | null => {
    const regex = new RegExp(
        `<tr class="border" data-key="\\d+">\\s*<td class="border border-light">${promoCodeName}</td>\\s*<td class="border border-light">\\s*<span class="label label-default">Не активирован</span>\\s*</td>\\s*<td class="border border-light"><span class="label label-info">.*?<\\/span><\\/td>\\s*<td class="border border-light" aria-label="Ник пользователя">.*?<\\/td>\\s*<td class="border border-light" aria-label="Минимальная сумма">.*?<\\/td>\\s*<td class="border border-light" aria-label="Размер скидки">\\s*<span class="label label-warning">(\\d+\\s?%)<\\/span>\\s*<\\/td>\\s*<td class="border border-light" aria-label="Кол-во активаций">(\\d+|Одноразовый)<\\/td>`,
        'i',
    );

    const match = regex.exec(html);

    if (match) {
        const activationsLeft = match[2] === 'Одноразовый' ? 1 : parseInt(match[2], 10);

        return {
            activationsLeft: activationsLeft,
            discount: parseInt(match[1], 10),
        };
    }
    return null;
};
