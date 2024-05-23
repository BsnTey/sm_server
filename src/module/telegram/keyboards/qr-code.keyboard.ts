import { Markup } from 'telegraf';

export const qrCodeUpdateKeyboard = Markup.inlineKeyboard([[Markup.button.callback(`Обновить Код`, `update_qrcode`)]]);
