import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { ALL_KEYS_MENU_BUTTON_NAME, CALCULATE_BONUS } from '../base-command/base-command.constants';
import { WizardContext } from 'telegraf/typings/scenes';
import { TelegramService } from '../../telegram.service';
import { calculateInfoKeyboard } from '../../keyboards/calculate.keyboard';
import { CalculateService } from './calculate.service';
import { Markup } from 'telegraf';
import { CALCULATE_SETTINGS_SCENE } from '../../scenes/calculate.scene-constant';
import { ICalculateCash } from '../../interfaces/calculate.interface';

@Scene(CALCULATE_BONUS.scene)
export class CalculateUpdate {
    constructor(
        private telegramService: TelegramService,
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
            `Цены на вещи вводим каждую с новой строки.\nВводим изначальную цену, БЕЗ УЧЕТА СКИДКИ.\nЕсли товар - инвентарь, велосипед, палатка, то к цене без пробела делаем приписку буквы - и.\nЕсли на товар установлена скидка от магазина, то через пробел указываем какая.\nЕсли товар по лучшей/финальной/желтой цене, то через пробел пишем букву л (или любую другую)\nНапример:\n7299 35\n8999\n6499 70\n7499 л\n2400и 20\n10000и`,
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

            let totalDiscountPromo = 0;
            let totalPricePromo = 0;

            let totalDiscount = 0;
            let totalPrice = 0;

            let priceWithoutDiscount = 0;

            const outputPrices = [];

            for (let value of prices) {
                let isInventory = false;

                let discountShop = 0;
                value = value.trim();
                const parts = value.split(' ');
                if (parts.length > 1) {
                    discountShop = /^\d+$/.test(parts[1]) ? parseInt(parts[1]) : 228;
                }

                if (parts[0].includes('и')) {
                    isInventory = true;
                    parts[0] = parts[0].split('и')[0];
                }

                const priceItem = parseInt(parts[0]);

                const currentPriceItem = this.calculateCurrentPrice(priceItem, discountShop);
                const currentBonus = this.calculateBonus(priceItem, currentPriceItem, discountShop, isInventory);
                const priceDiscount = currentPriceItem - currentBonus;

                priceWithoutDiscount += currentPriceItem;

                const currentPriceItemPromo = this.calculatePriceWithPromoWithoutBonus(
                    priceItem,
                    currentPriceItem,
                    discountShop,
                    isInventory,
                );

                const currentBonusPromo = this.calculateBonus(priceItem, currentPriceItemPromo, discountShop, isInventory);
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

            // Сохраняем результаты расчетов в кеш
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

            // Получаем шаблоны пользователя для отображения в клавиатуре
            const templates = await this.calculateService.getUserTemplates(String(telegramId));

            const keyboardButtons = [[Markup.button.callback(`Показать расчет индивидуально`, `go_to_calculate_show`)]];

            // Если есть шаблоны, добавляем их в клавиатуру
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
                        
Расчет с промо:
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
            message += `Изначальная цена: ${value['price']}\nТекущая цена со скидкой: ${value['priceDiscount']}\nКоличество возможно примененных бонусов: ${value['currentBonus']}\n\n`;
        });
        await ctx.reply(message);
    }

    @Action(/^use_template_(.+)$/)
    async useTemplate(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const templateId = ctx.match[1];
        const template = await this.calculateService.getTemplateById(templateId);

        if (!template) {
            await ctx.reply('Шаблон не найден.');
            return;
        }

        const calculationResult = await this.telegramService.getDataFromCache<ICalculateCash>(String(telegramId));

        if (!calculationResult) {
            await ctx.reply('Данные расчета не найдены. Пожалуйста, сделайте новый расчет.');
            return;
        }

        // Рассчитываем комиссию в зависимости от настроек шаблона
        const commission = this.calculateService.calculateCommission(
            template.commissionType,
            template.commissionRate,
            template.roundTo,
            calculationResult.totalPriceBonus,
            calculationResult.totalDiscountPromo,
            calculationResult.totalFullDiscount,
        );

        // Применяем шаблон
        const message = this.calculateService.applyTemplate(template.template, calculationResult.totalSumOnKassa, commission);

        await ctx.reply(`<code>${message}</code>`, {
            parse_mode: 'HTML',
        });
    }

    private calculateCurrentPrice(price: number, discountShop: number) {
        if (discountShop === 228) {
            return price;
        }

        let currentPriceItem = (1 - discountShop / 100) * price;
        if (discountShop % 5 !== 0) {
            const lastNumberPrice = currentPriceItem % 100;
            const roundPrice = Math.floor(currentPriceItem / 100) * 100;
            currentPriceItem = lastNumberPrice < 50 ? roundPrice - 1 : roundPrice + 99;
        }

        return Math.floor(currentPriceItem);
    }

    private calculateBonus(price: number, currentPriceItem: number, discountShop: number, isInventory: boolean = false) {
        let currentBonus = 0;

        if (0 <= discountShop && discountShop < 50) {
            // Используем 20% вместо 30% для инвентаря
            const bonusPercentage = isInventory ? 0.2 : 0.3;
            currentBonus = currentPriceItem * bonusPercentage;

            // Максимальная скидка 30% для инвентаря, 50% для обычных товаров
            const maxDiscountFactor = isInventory ? 0.3 : 0.5;
            const maxDiscountItem = price * maxDiscountFactor;

            if (currentPriceItem - currentBonus < price - maxDiscountItem) {
                currentBonus = currentPriceItem - (price - maxDiscountItem);
            }
        }
        return Math.floor(currentBonus);
    }

    private calculatePriceWithPromoWithoutBonus(
        price: number,
        currentPriceItem: number,
        discountShop: number,
        isInventory: boolean = false,
    ) {
        let calcPrice = currentPriceItem;

        if (0 <= discountShop && discountShop < 50) {
            const priceWithPromo = currentPriceItem * 0.9;

            // Максимальная скидка 30% для инвентаря, 50% для обычных товаров
            const maxDiscountFactor = isInventory ? 0.3 : 0.5;
            const maxDiscountItem = price * maxDiscountFactor;

            if (price - priceWithPromo > maxDiscountItem) {
                calcPrice = price - maxDiscountItem;
            } else {
                calcPrice = priceWithPromo;
            }
        }
        return Math.floor(calcPrice);
    }
}
