import { Markup } from 'telegraf';

export const profileKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`Чекер промо`, 'check_promo')],
    [Markup.button.callback(`Получить инфо по заказу`, 'get_info_order')],
]);
