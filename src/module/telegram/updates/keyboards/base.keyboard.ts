import { Markup } from 'telegraf';
import {
    CALCULATE_BONUS,
    CASH_RECEIPT,
    CHANGE_NUMBER,
    CHECK,
    COOKIE,
    HELP,
    MAKE_ORDER,
    PROFILE,
    QR_CODE,
} from '../base-command/base-command.constants';

function getMainMenuKeyboard() {
    return Markup.keyboard([
        [CHANGE_NUMBER.name, MAKE_ORDER.name],
        [CALCULATE_BONUS.name, CHECK.name],
        [COOKIE.name, QR_CODE.name, CASH_RECEIPT.name],
        [PROFILE.name, HELP.name],
    ]).resize();
}

export const mainMenuKeyboard = getMainMenuKeyboard();
