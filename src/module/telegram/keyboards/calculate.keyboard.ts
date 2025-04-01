import { Markup } from 'telegraf';
import { UserTemplate } from '@prisma/client';

export const calculateInfoKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`Как пользоваться калькулятором`, `go_to_calculate_info`)],
    [Markup.button.callback(`Настройки шаблонов`, `go_to_calculate_settings`)],
]);

export const calculateShowKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`Показать расчет индивидуально`, `go_to_calculate_show`)],
]);

export const calculateTemplatesKeyboard = (templates: UserTemplate[] = []) => {
    const keyboard = [
        [Markup.button.callback('Создать новый шаблон', 'create_template')],
        ...templates.map(template => [Markup.button.callback(template.name, `template_${template.id}`)]),
        [Markup.button.callback('Назад', 'back_to_calculate')],
    ];

    return Markup.inlineKeyboard(keyboard);
};
