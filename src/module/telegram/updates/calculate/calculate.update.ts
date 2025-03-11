import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { ALL_KEYS_MENU_BUTTON_NAME, CALCULATE_BONUS } from '../base-command/base-command.constants';
import { WizardContext } from 'telegraf/typings/scenes';
import { TelegramService } from '../../telegram.service';
import { calculateInfoKeyboard, calculateShowKeyboard } from '../../keyboards/calculate.keyboard';

@Scene(CALCULATE_BONUS.scene)
export class CalculateUpdate {
    constructor(private telegramService: TelegramService) {}

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
            `Цены на вещи вводим каждую с новой строки.\nВводим изначальную цену, БЕЗ УЧЕТА СКИДКИ\nЕсли на товар установлена скидка от магазина, то через пробел указываем какая.\nЕсли товар по лучшей/финальной/желтой цене, то через пробел пишем букву л (или любую другую)\nЕсли товар из категории: тренажеры, велики, лыжи, палатки и прочий инвентарь, то у цены указываем букву "и".\nНапример:\n7299 35\n8999\n6499 70\n7499 л\n 10000и\n80000и 15`,
        );
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
                let discountShop = 0;
                let hasIndividualBonus = false;

                value = value.trim();
                const parts = value.split(' ');

                // Проверяем, есть ли у цены маркер "и"
                if (parts[0].endsWith('и')) {
                    hasIndividualBonus = true;
                    // Удаляем "и" из цены для расчетов
                    parts[0] = parts[0].slice(0, -1);
                }

                if (parts.length > 1) {
                    discountShop = /^\d+$/.test(parts[1]) ? parseInt(parts[1]) : 228;
                }

                const priceItem = parseInt(parts[0]);

                const currentPriceItem = this.calculateCurrentPrice(priceItem, discountShop);
                const currentBonus = this.calculateBonus(priceItem, currentPriceItem, discountShop, hasIndividualBonus);
                const priceDiscount = currentPriceItem - currentBonus;

                priceWithoutDiscount += currentPriceItem;

                const currentPriceItemPromo = this.calculatePriceWithPromoWithoutBonus(
                    priceItem,
                    currentPriceItem,
                    discountShop,
                    hasIndividualBonus,
                );
                const currentBonusPromo = this.calculateBonus(priceItem, currentPriceItemPromo, discountShop, hasIndividualBonus);
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
            await this.telegramService.setDataCache<any[]>(String(telegramId), outputPrices);
            await ctx.reply(
                `Расчет без промо:
Цена на кассу: ${totalPrice}
Количество возможно примененных бонусов: ${totalDiscount}

Расчет с промо:
Цена на кассу: ${totalPricePromo}
Количество возможно примененных бонусов: ${totalDiscountPromo}
Общая скидка (бонусы + промо): ${priceWithoutDiscount - totalPricePromo}`,
                calculateShowKeyboard,
            );
        } catch (e) {
            await ctx.reply('Что то пошло не так. Проверьте правильность введения');
        }
    }

    @Action('go_to_calculate_show')
    async goToCalculateShow(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const calculatePrices = await this.telegramService.getDataFromCache<any[]>(String(telegramId));

        let message = '';
        calculatePrices.forEach(value => {
            message += `Изначальная цена: ${value['price']}\nТекущая цена со скидкой: ${value['priceDiscount']}\nКоличество возможно примененных бонусов: ${value['currentBonus']}\n\n`;
        });
        await ctx.reply(message);
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

    private calculateBonus(price: number, currentPriceItem: number, discountShop: number, hasIndividualBonus: boolean) {
        let currentBonus = 0;

        if (0 <= discountShop && discountShop < 50) {
            const bonusPercentage = hasIndividualBonus ? 0.2 : 0.3;
            currentBonus = currentPriceItem * bonusPercentage;

            const maxDiscountItem = hasIndividualBonus ? price * 0.7 : price / 2;
            if (currentPriceItem - currentBonus < maxDiscountItem) {
                currentBonus = currentPriceItem - maxDiscountItem;
            }
        }
        return Math.floor(currentBonus);
    }

    private calculatePriceWithPromoWithoutBonus(
        price: number,
        currentPriceItem: number,
        discountShop: number,
        hasIndividualBonus: boolean,
    ) {
        let calcPrice = currentPriceItem;

        if (0 <= discountShop && discountShop < 50) {
            const priceWithPromo = currentPriceItem * 0.9;
            const maxDiscountItem = hasIndividualBonus ? price * 0.7 : price / 2;
            if (price - priceWithPromo > maxDiscountItem) {
                calcPrice = maxDiscountItem;
            } else {
                calcPrice = priceWithPromo;
            }
        }
        return Math.floor(calcPrice);
    }
}
