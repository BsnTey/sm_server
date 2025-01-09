import { Markup } from 'telegraf';

export const gotoCoupon = Markup.inlineKeyboard([[Markup.button.callback('Получить личный промо', 'goto_coupon')]]);
