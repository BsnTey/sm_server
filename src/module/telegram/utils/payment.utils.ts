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

export const extractUsersStatistics = (html: string, usersException: string[]): UserStatistic[] => {
    const regex =
        /<th scope="row">(\d+)<\/th>\s*<td>(?:<a href="tg:\/\/user\?id=(\d+)">([^<]+)<\/a>|(@[\w_]+))<\/td>\s*<td>([\d\s]+) ₽<\/td>/g;
    const usersStatistics: Array<UserStatistic> = [];
    let match: RegExpExecArray | null;
    let exceptionCount = 0;

    while ((match = regex.exec(html)) !== null) {
        let row = parseInt(match[1], 10);
        const tgId = match[2] || null;
        const name = match[3] ? match[3].trim() : match[4].trim().replace(/^@/, '');

        if (usersException.includes(name)) {
            exceptionCount++;
            continue;
        }
        row -= exceptionCount;

        usersStatistics.push({ row, name, tgId });
    }

    if (usersStatistics.length === 0) {
        throw new Error('Статистика пользователей не найдена');
    }

    return usersStatistics;
};

export const getPromoCodeDetailsFromHtml = (html: string, promoCodeName: string): USerPromocodeActivations | null => {
    const regex = new RegExp(
        `<tr>\\s*<td>${promoCodeName}<\\/td>\\s*<td>Не активирован<\\/td>\\s*<td>Скидка в процентах<\\/td>\\s*<td>-<\\/td>\\s*<td>(\\d+)<\\/td>\\s*<td>(\\d+\\s?%)<\\/td>\\s*<td>(\\d+|Одноразовый)<\\/td>`,
        'i',
    );
    const regex2 = new RegExp(
        `<tr[^>]*?>\\s*<td[^>]*?>${promoCodeName}<\\/td>\\s*<td[^>]*?aria-label=\\"Статус\\"[^>]*?>Не активирован<\\/td>\\s*<td[^>]*?aria-label=\\"Тип\\"[^>]*?>Скидка в процентах<\\/td>\\s*<td[^>]*?aria-label=\\"Ник пользователя\\"[^>]*?>-<\\/td>\\s*<td[^>]*?aria-label=\\"Минимальная сумма\\"[^>]*?>(\\d+)<\\/td>\\s*<td[^>]*?aria-label=\\"Размер скидки\\"[^>]*?><span[^>]*?>(\\d+\\s?%)<\\/span><\\/td>\\s*<td[^>]*?aria-label=\\"Кол-во активаций\\"[^>]*?>(\\d+|Одноразовый)<\\/td>`,
        'i',
    );

    const regex3 = new RegExp(
        `<tr[^>]*?>\\s*<td[^>]*?>${promoCodeName}<\\/td>\\s*<td[^>]*?aria-label=\\"Статус\\"[^>]*?>Не активирован<\\/td>\\s*<td[^>]*?aria-label=\\"Тип\\"[^>]*?>Скидка в процентах<\\/td>\\s*<td[^>]*?aria-label=\\"Ник пользователя\\"[^>]*?>-<\\/td>\\s*<td[^>]*?aria-label=\\"Минимальная сумма\\"[^>]*?>(\\d+)<\\/td>\\s*<td[^>]*?aria-label=\\"Размер скидки\\/начисления\\"[^>]*?><span[^>]*?>(\\d+\\s?%)<\\/span><\\/td>\\s*<td[^>]*?aria-label=\\"Кол-во активаций\\"[^>]*?>(\\d+|Одноразовый)<\\/td>`,
        'i',
    );

    const match1 = regex.exec(html);
    const match2 = regex2.exec(html);
    const match3 = regex3.exec(html);

    if (match1 || match2 || match3) {
        const match = match1 || match2 || match3;
        const activationsLeft = match![3] === 'Одноразовый' ? 1 : parseInt(match![3], 10);
        return {
            activationsLeft: activationsLeft,
            discount: parseInt(match![2], 10),
        };
    }
    return null;
};
