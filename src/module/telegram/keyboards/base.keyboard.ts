import { Markup } from 'telegraf';
import {
    AUTH_MIRROR,
    CALCULATE_BONUS,
    CASH_RECEIPT,
    CHANGE_NUMBER,
    CHECK,
    COOKIE,
    FAMILY_ALIAS,
    HELP,
    MAKE_ORDER,
    PROFILE,
    QR_CODE,
} from '../updates/base-command/base-command.constants';
import { UserRole } from '@prisma/client';

export function getMainMenuKeyboard(role?: UserRole) {
    const firstRow = [CHANGE_NUMBER.name, MAKE_ORDER.name];
    const secondRow = [CALCULATE_BONUS.name, CHECK.name];
    const thirdRow = [COOKIE.name, QR_CODE.name, CASH_RECEIPT.name];
    const fourthRow = [PROFILE.name, HELP.name];
    if (role == UserRole.Admin) firstRow.unshift(AUTH_MIRROR.name);
    if (role == UserRole.Admin || role == UserRole.Seller) fourthRow.unshift(FAMILY_ALIAS.name);
    const keyboard = [firstRow, secondRow, thirdRow, fourthRow];

    return Markup.keyboard(keyboard).resize();
}
