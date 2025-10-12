import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { ALL_KEYS_MENU_BUTTON_NAME, CALCULATE_BONUS } from '../base-command/base-command.constants';
import { WizardContext } from 'telegraf/typings/scenes';
import { TelegramService } from '../../telegram.service';
import { calculateInfoKeyboard } from '../../keyboards/calculate.keyboard';
import { CalculateServiceTelegram } from './calculate.service';
import { Markup } from 'telegraf';
import { CALCULATE_SETTINGS_SCENE } from '../../scenes/calculate.scene-constant';
import { ICalculateCash } from '../../interfaces/calculate.interface';
import { CalculateService } from '../../../calculate/calculate.service';

@Scene(CALCULATE_BONUS.scene)
export class CalculateUpdate {
    constructor(
        private telegramService: TelegramService,
        private calculateServiceTelegram: CalculateServiceTelegram,
        private calculateService: CalculateService,
    ) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply('🔑 Введите цены вещей', calculateInfoKeyboard);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @Action('go_to_calculate_info')
    async goToCalculateInfo(@Ctx() ctx: WizardContext) {
        await ctx.reply(
            `Цены на вещи вводим каждую с новой строки.
    Вводим изначальную цену, БЕЗ УЧЕТА СКИДКИ.
    Если товар - инвентарь, велосипед, палатка, то к цене без пробела делаем приписку буквы - и.
    Если на товар установлена скидка от магазина, то через пробел указываем какая.
    Если товар по лучшей/финальной/желтой цене, то через пробел пишем букву л (или любую другую)
    Например:
    7299 35
    8999
    6499 70
    7499 л
    2400и 20
    10000и`,
        );
    }

    @Action('go_to_calculate_settings')
    async goToCalculateSettings(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CALCULATE_SETTINGS_SCENE);
    }

    @On('text')
    async calculatePrice(@Ctx() ctx: WizardContext, @Message('text') inputPrices: string, @Sender() { id: telegramId }: any) {
        try {
            const prices: string[] = inputPrices.split(/\r?\n/);

            // Процент промо вводим как аргумент (здесь 10%, потом можно менять на 15 или брать из внешнего сервиса)
            const promoPercent = 10;

            let totalDiscountPromo = 0;
            let totalPricePromo = 0;

            let totalDiscount = 0;
            let totalPrice = 0;

            let priceWithoutDiscount = 0;

            const outputPrices: Array<{
                price: string;
                priceDiscount: number;
                currentBonus: number;
                currentBonusPromo: number;
                priceDiscountPromo: number;
            }> = [];

            for (const raw of prices) {
                let isInventory = false;

                let discountShop = 0;
                const value = raw.trim();
                const parts = value.split(' ');

                if (parts.length > 1) {
                    discountShop = /^\d+$/.test(parts[1]) ? parseInt(parts[1]) : 228;
                }

                if (parts[0].includes('и')) {
                    isInventory = true;
                    parts[0] = parts[0].split('и')[0];
                }

                const priceItem = parseInt(parts[0], 10);

                const currentPriceItem = this.calculateService.computeCurrentPrice(priceItem, discountShop);

                // Бонусы без промокода
                const currentBonus = this.calculateService.computeBonus(priceItem, currentPriceItem, discountShop, isInventory);

                const priceDiscount = currentPriceItem - currentBonus;
                priceWithoutDiscount += currentPriceItem;

                const currentPriceItemPromo = this.calculateService.computePriceWithPromoWithoutBonus(
                    priceItem,
                    currentPriceItem,
                    discountShop,
                    isInventory,
                    promoPercent,
                );

                const currentBonusPromo = this.calculateService.computeBonus(priceItem, currentPriceItemPromo, discountShop, isInventory);

                const priceDiscountPromo = currentPriceItemPromo - currentBonusPromo;

                totalPrice += priceDiscount;
                totalDiscount += currentBonus;

                totalPricePromo += priceDiscountPromo;
                totalDiscountPromo += currentBonusPromo;

                const priceStr = parts.length > 1 ? `${parts[0]} ${parts[1]}` : `${parts[0]}`;

                outputPrices.push({
                    price: priceStr,
                    priceDiscount,
                    currentBonus,
                    currentBonusPromo,
                    priceDiscountPromo,
                });
            }

            const totalFullDiscountTmp = priceWithoutDiscount - totalPricePromo;

            const calculationResult: ICalculateCash = {
                outputPrices,
                totalPrice,
                totalDiscount,
                totalPriceBonus: totalDiscountPromo,
                totalDiscountPromo: totalFullDiscountTmp - totalDiscountPromo,
                totalFullDiscount: totalFullDiscountTmp,
                totalSumOnKassa: totalPricePromo,
            };

            await this.telegramService.setDataCache<ICalculateCash>(String(telegramId), calculationResult);

            const templates = await this.calculateServiceTelegram.getUserTemplates(String(telegramId));

            const keyboardButtons = [[Markup.button.callback(`Показать расчет индивидуально`, `go_to_calculate_show`)]];

            if (templates.length > 0) {
                const templateButtons = templates.map((template: { name: any; id: any }) =>
                    Markup.button.callback(`Шаблон: ${template.name}`, `use_template_${template.id}`),
                );
                keyboardButtons.push(templateButtons);
            }

            await ctx.reply(
                `Расчет без промо:
Цена на кассу: ${totalPrice}
Количество возможно примененных бонусов: ${totalDiscount}
                        
Расчет с промо (${promoPercent}%):
Цена на кассу: ${totalPricePromo}
Количество возможно примененных бонусов: ${totalDiscountPromo}
Общая скидка (бонусы + промо): ${priceWithoutDiscount - totalPricePromo}`,
                Markup.inlineKeyboard(keyboardButtons),
            );
        } catch (e) {
            await ctx.reply('Что то пошло не так. Проверьте правильность введения');
        }
    }

    @Action('go_to_calculate_show')
    async goToCalculateShow(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const calculationResult = await this.telegramService.getDataFromCache<any>(String(telegramId));

        if (!calculationResult || !calculationResult.outputPrices) {
            await ctx.reply('Данные расчета не найдены. Пожалуйста, сделайте новый расчет.');
            return;
        }

        let message = '';
        calculationResult.outputPrices.forEach((value: { [x: string]: any }) => {
            message += `Изначальная цена: ${value['price']}
Текущая цена со скидкой: ${value['priceDiscount']}
Количество возможно примененных бонусов: ${value['currentBonus']}

`;
        });
        await ctx.reply(message);
    }

    @Action(/^use_template_(.+)$/)
    async useTemplate(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const templateId = ctx.match[1];
        const template = await this.calculateServiceTelegram.getTemplateById(templateId);

        if (!template) {
            await ctx.reply('Шаблон не найден.');
            return;
        }

        const calculationResult = await this.telegramService.getDataFromCache<ICalculateCash>(String(telegramId));

        if (!calculationResult) {
            await ctx.reply('Данные расчета не найдены. Пожалуйста, сделайте новый расчет.');
            return;
        }

        const commission = this.calculateServiceTelegram.calculateCommission(
            template.commissionType,
            template.commissionRate,
            template.roundTo,
            calculationResult.totalPriceBonus,
            calculationResult.totalDiscountPromo,
            calculationResult.totalFullDiscount,
        );

        const message = this.calculateServiceTelegram.applyTemplate(template.template, calculationResult.totalSumOnKassa, commission);

        await ctx.reply(`<code>${message}</code>`, {
            parse_mode: 'HTML',
        });
    }
}
