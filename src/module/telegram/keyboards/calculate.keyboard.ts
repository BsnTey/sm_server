import { Markup } from 'telegraf';

export const calculateInfoKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`Как пользоваться калькулятором`, `go_to_calculate_info`)],
]);

export const calculateShowKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`Показать расчет индивидуально`, `go_to_calculate_show`)],
]);
