import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { ALL_KEYS_MENU_BUTTON_NAME, CALCULATE_BONUS } from '../base-command/base-command.constants';
import { WizardContext } from 'telegraf/typings/scenes';
import { Markup } from 'telegraf';
import { calculateTemplatesKeyboard } from '../../keyboards/calculate.keyboard';
import {
    CALCULATE_SETTINGS_SCENE,
    COMMISSION_RATE_SCENE,
    COMMISSION_TYPE_SCENE,
    CUSTOM_ROUND_SCENE,
    ROUND_TO_SCENE,
    TEMPLATE_NAME_SCENE,
    TEMPLATE_TEXT_SCENE,
} from '../../scenes/calculate.scene-constant';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { NotFoundException } from '@nestjs/common';
import { ERROR_FOUND_USER } from '../../constants/error.constant';
import { TemplateService } from '../../../template/template.service';
import { CommissionType } from '@prisma/client';
import { BaseUpdate } from '../base/base.update';

const TEMPLATE_TTL = 3600;

@Scene(CALCULATE_SETTINGS_SCENE)
export class CalculateSettingsScene extends BaseUpdate {
    constructor(private calculateService: TemplateService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const templates = await this.calculateService.getUserTemplates(String(telegramId));

        if (templates.length === 0) {
            await ctx.editMessageText(
                'У вас пока нет шаблонов. Создадим новый шаблон?',
                Markup.inlineKeyboard([
                    [Markup.button.callback('Создать шаблон', 'create_template')],
                    [Markup.button.callback('Назад', 'back_to_calculate')],
                ]),
            );
        } else {
            await ctx.editMessageText('Ваши шаблоны:', calculateTemplatesKeyboard(templates));
        }
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @Action('back_to_calculate')
    async backToCalculate(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CALCULATE_BONUS.scene);
    }

    @Action('create_template')
    async createTemplate(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        // Очищаем все данные о текущем создаваемом шаблоне
        await this.cacheService.set(`template_draft:${telegramId}`, {}, TEMPLATE_TTL);
        await ctx.scene.enter(TEMPLATE_NAME_SCENE);
    }

    @Action(/^template_(.+)$/)
    async viewTemplate(@Ctx() ctx: WizardContext) {
        //@ts-ignore
        const templateId = ctx.match[1];
        const template = await this.calculateService.getTemplateById(templateId);

        if (!template) {
            await ctx.editMessageText('Шаблон не найден.');
            return;
        }

        const commissionTypes: Record<CommissionType, string> = {
            BONUS: 'От бонусов',
            PROMO: 'От промокода',
            TOTAL: 'От общей скидки',
        };

        await ctx.editMessageText(
            `Шаблон: ${template.name}\n\n` +
                `Текст шаблона:\n${template.template.replace(/\/n/g, '\n')}\n\n` +
                `Тип комиссии: ${commissionTypes[template.commissionType as CommissionType]}\n` +
                `Ставка комиссии: ${template.commissionRate}%\n` +
                `Округление до: ${template.roundTo}`,
            Markup.inlineKeyboard([
                [Markup.button.callback('Удалить шаблон', `delete_template_${template.id}`)],
                [Markup.button.callback('Назад', 'back_to_settings')],
            ]),
        );
    }

    @Action(/^delete_template_(.+)$/)
    async deleteTemplate(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        //@ts-ignore
        const templateId = ctx.match[1];
        await this.calculateService.deleteTemplate(templateId, String(telegramId));
        await ctx.editMessageText('Шаблон удален.');
        await this.onSceneEnter(ctx, { id: telegramId });
    }

    @Action('back_to_settings')
    async backToSettings(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        await this.onSceneEnter(ctx, { id: telegramId });
    }
}

@Scene(TEMPLATE_NAME_SCENE)
export class TemplateNameScene extends BaseUpdate {
    constructor() {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.editMessageText('Введите название шаблона:');
    }

    @Hears('Отмена')
    async cancel(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CALCULATE_BONUS.scene);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @On('text')
    async onNameEntered(@Ctx() ctx: WizardContext, @Message('text') name: string, @Sender() { id: telegramId }: any) {
        const templateData = (await this.cacheService.get<any>(`template_draft:${telegramId}`)) || {};
        templateData.name = name;
        await this.cacheService.set(`template_draft:${telegramId}`, templateData, TEMPLATE_TTL);

        await ctx.scene.enter(TEMPLATE_TEXT_SCENE);
    }
}

@Scene(TEMPLATE_TEXT_SCENE)
export class TemplateTextScene extends BaseUpdate {
    constructor() {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply(
            'Введите текст шаблона.\n\n' +
                'Вы можете использовать следующие переменные:\n' +
                '{payment} - сумма к оплате\n' +
                '{commission} - сумма комиссии\n\n' +
                'Для переноса строки используйте /n\n\n' +
                'Пример:\n' +
                'Здравствуйте./n' +
                'Цена на кассу: {payment}р/n' +
                'Комиссия {commission}р.',
            Markup.keyboard([['Отмена']])
                .oneTime()
                .resize(),
        );
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @Hears('Отмена')
    async cancel(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CALCULATE_BONUS.scene);
    }

    @On('text')
    async onTextEntered(@Ctx() ctx: WizardContext, @Message('text') text: string, @Sender() { id: telegramId }: any) {
        if (text === 'Отмена') return;

        const templateData = (await this.cacheService.get<any>(`template_draft:${telegramId}`)) || {};
        templateData.template = text;
        await this.cacheService.set(`template_draft:${telegramId}`, templateData, TEMPLATE_TTL);

        await ctx.scene.enter(COMMISSION_TYPE_SCENE);
    }
}

@Scene(COMMISSION_TYPE_SCENE)
export class CommissionTypeScene extends BaseUpdate {
    constructor() {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply(
            'Выберите тип комиссии:',
            Markup.inlineKeyboard([
                [Markup.button.callback('От бонусов', 'commission_BONUS')],
                [Markup.button.callback('От промокода', 'commission_PROMO')],
                [Markup.button.callback('От общей скидки', 'commission_TOTAL')],
                [Markup.button.callback('Отмена', 'cancel_template')],
            ]),
        );
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @Action('cancel_template')
    async cancel(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CALCULATE_SETTINGS_SCENE);
    }

    @Action(/^commission_(.+)$/)
    async onTypeSelected(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        //@ts-ignore
        const commissionType = ctx.match[1];

        const templateData = (await this.cacheService.get<any>(`template_draft:${telegramId}`)) || {};
        templateData.commissionType = commissionType;
        await this.cacheService.set(`template_draft:${telegramId}`, templateData, TEMPLATE_TTL);

        await ctx.scene.enter(COMMISSION_RATE_SCENE);
    }
}

@Scene(COMMISSION_RATE_SCENE)
export class CommissionRateScene extends BaseUpdate {
    constructor() {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply(
            'Введите процент комиссии (например, 15 для 15%):',
            Markup.keyboard([['Отмена']])
                .oneTime()
                .resize(),
        );
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @Hears('Отмена')
    async cancel(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(COMMISSION_TYPE_SCENE);
    }

    @On('text')
    async onRateEntered(@Ctx() ctx: WizardContext, @Message('text') text: string, @Sender() { id: telegramId }: any) {
        if (text === 'Отмена') return;

        try {
            const rate = parseFloat(text);
            if (isNaN(rate) || rate < 0 || rate > 100) {
                await ctx.reply('Пожалуйста, введите число от 0 до 100.');
                return;
            }

            const templateData = (await this.cacheService.get<any>(`template_draft:${telegramId}`)) || {};
            templateData.commissionRate = rate;
            await this.cacheService.set(`template_draft:${telegramId}`, templateData, TEMPLATE_TTL);

            await ctx.scene.enter(ROUND_TO_SCENE);
        } catch {
            await ctx.reply('Пожалуйста, введите корректное число.');
        }
    }
}

@Scene(ROUND_TO_SCENE)
export class RoundToScene extends BaseUpdate {
    constructor(private templateService: TemplateService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply(
            'До какого значения округлять комиссию (10, 50, 100 и т.д.)?',
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('10', 'round_10'),
                    Markup.button.callback('50', 'round_50'),
                    Markup.button.callback('100', 'round_100'),
                ],
                [Markup.button.callback('Другое значение', 'round_other')],
                [Markup.button.callback('Отмена', 'cancel_template')],
            ]),
        );
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @Action('cancel_template')
    async cancel(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CALCULATE_SETTINGS_SCENE);
    }

    @Action(/^round_(\d+)$/)
    async onRoundSelected(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        //@ts-ignore
        const roundTo = parseInt(ctx.match[1]);
        await this.saveTemplate(ctx, String(telegramId), roundTo);
    }

    @Action('round_other')
    async onCustomRound(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CUSTOM_ROUND_SCENE);
    }

    private async saveTemplate(ctx: WizardContext, telegramId: string, roundTo: number) {
        const templateData = await this.cacheService.get<any>(`template_draft:${telegramId}`);

        if (!templateData || !templateData.name || !templateData.template || !templateData.commissionType || !templateData.commissionRate) {
            await ctx.editMessageText('Что-то пошло не так. Пожалуйста, начните создание шаблона заново.');
            await ctx.scene.enter(CALCULATE_SETTINGS_SCENE);
            return;
        }

        await this.templateService.createTemplate({
            userTelegramId: telegramId,
            name: templateData.name,
            template: templateData.template,
            commissionType: templateData.commissionType,
            commissionRate: templateData.commissionRate,
            roundTo,
        });

        await this.cacheService.del(`template_draft:${telegramId}`);

        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        const keyboard = getMainMenuKeyboard(user.role);

        await ctx.reply('Шаблон успешно создан', keyboard);

        await ctx.scene.enter(CALCULATE_BONUS.scene);
    }

    @Action('back_to_settings')
    async backToSettings(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CALCULATE_SETTINGS_SCENE);
    }
}

@Scene(CUSTOM_ROUND_SCENE)
export class CustomRoundScene extends BaseUpdate {
    constructor(private templateService: TemplateService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply(
            'Введите значение для округления:',
            Markup.keyboard([['Отмена']])
                .oneTime()
                .resize(),
        );
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @Hears('Отмена')
    async cancel(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(ROUND_TO_SCENE);
    }

    @On('text')
    async onCustomRoundEntered(@Ctx() ctx: WizardContext, @Message('text') text: string, @Sender() { id: telegramId }: any) {
        if (text === 'Отмена') return;

        try {
            const roundTo = parseInt(text);
            if (isNaN(roundTo) || roundTo <= 0) {
                await ctx.editMessageText('Пожалуйста, введите положительное целое число.');
                return;
            }

            const templateData = await this.cacheService.get<any>(`template_draft:${telegramId}`);

            if (
                !templateData ||
                !templateData.name ||
                !templateData.template ||
                !templateData.commissionType ||
                !templateData.commissionRate
            ) {
                await ctx.editMessageText('Что-то пошло не так. Пожалуйста, начните создание шаблона заново.');
                await ctx.scene.enter(CALCULATE_SETTINGS_SCENE);
                return;
            }

            await this.templateService.createTemplate({
                userTelegramId: telegramId,
                name: templateData.name,
                template: templateData.template,
                commissionType: templateData.commissionType,
                commissionRate: templateData.commissionRate,
                roundTo,
            });

            await this.cacheService.del(`template_draft:${telegramId}`);

            const user = await this.userService.getUserByTelegramId(String(telegramId));
            if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

            const keyboard = getMainMenuKeyboard(user.role);

            await ctx.reply('Шаблон успешно создан', keyboard);

            await ctx.scene.enter(CALCULATE_BONUS.scene);
        } catch {
            await ctx.reply('Пожалуйста, введите корректное число.');
        }
    }

    @Action('back_to_calculate')
    async backToSettings(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CALCULATE_BONUS.scene);
    }
}
