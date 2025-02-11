import { Markup } from 'telegraf';
import {
    AUTH_MIRROR,
    CALCULATE_BONUS,
    CASH_RECEIPT,
    CHANGE_NUMBER,
    CHECK,
    COOKIE,
    HELP,
    MAKE_ORDER,
    PROFILE,
    QR_CODE,
} from '../updates/base-command/base-command.constants';
import { UserRole } from '@prisma/client';

export function getMainMenuKeyboard(role?: UserRole) {
    const firstRow = [CHANGE_NUMBER.name, MAKE_ORDER.name];
    if (role != 'User') firstRow.unshift(AUTH_MIRROR.name);
    const keyboard = [
        firstRow,
        [CALCULATE_BONUS.name, CHECK.name],
        [COOKIE.name, QR_CODE.name, CASH_RECEIPT.name],
        [PROFILE.name, HELP.name],
    ];

    return Markup.keyboard(keyboard).resize();
}
