import { Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { Logger, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { MY_DISCOUNT_SCENE } from '../../scenes/profile.scene-constant';
import { ALL_KEYS_MENU_BUTTON_NAME } from '../base-command/base-command.constants';
import { BaseUpdate } from '../base/base.update';
import { SenderTelegram } from '../../interfaces/telegram.context';
import { AccountService } from '../../../account/account.service';
import { CalculateService } from '../../../calculate/calculate.service';
import { CheckingService } from '../../../checking/checking.service';

@Scene(MY_DISCOUNT_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class MyDiscountUpdate extends BaseUpdate {
    private readonly logger = new Logger(MyDiscountUpdate.name);

    constructor(
        private readonly accountService: AccountService,
        private readonly calculateService: CalculateService,
        private readonly checkingService: CheckingService,
    ) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply('🔎 Пришлите номер продукта (из URL строки) или артикул, или SKU для проверки');
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async findProduct(@Message('text') products: string, @Sender() sender: SenderTelegram, @Ctx() ctx: WizardContext) {
        const telegramId = String(sender.id);
        const productsRaw = products
            .split('\n')
            .map(p => p.trim())
            .filter(Boolean);

        if (!productsRaw.length) {
            await ctx.reply('⚠️ Пожалуйста, пришлите productId, артикул или SKU.');
            return;
        }

        try {
            // 1. Search for products by variants
            const foundProducts = await this.checkingService.findProductsByQueries(productsRaw);

            if (!foundProducts.length) {
                await ctx.reply('❌ Моя скидка не проходит на этот товар, либо данные для поиска не верны');
                return;
            }

            const productIds = foundProducts.map(p => p.productId);

            // 2. Try to find intersection (accounts that have discount for ALL products)
            if (productIds.length > 1) {
                const intersection = await this.checkingService.findAccountsForProductsIntersection(telegramId, productIds);

                if (intersection.accounts.length > 0) {
                    const lines: string[] = [];
                    lines.push('🔎 <b>Результат поиска (пересечение):</b>');
                    lines.push('');
                    lines.push('📦 Товары:');
                    for (const p of foundProducts) {
                        lines.push(`- ${p.article || p.sku || p.productId} (${p.productId})`);
                    }
                    lines.push('');
                    lines.push(`✅ Найдено ${intersection.accounts.length} аккаунт(ов), где есть скидка на ВСЕ эти товары.`);
                    lines.push('👇 Топ-10 аккаунтов:');
                    lines.push('');

                    const topAccounts = intersection.accounts.slice(0, 10);
                    for (const acc of topAccounts) {
                        const ordersPart = acc.ordersNumber > 0 ? ` (${acc.ordersNumber})` : '';
                        lines.push(`• <code>${acc.accountId}</code>${ordersPart} — бонусов: ${acc.bonus}`);
                    }

                    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
                    return;
                }
            }

            // 3. If no intersection or single product, show results for each product separately
            for (const productInfo of foundProducts) {
                const { productId } = productInfo;

                const result = await this.checkingService.getAccountsForPersonalDiscountV3(telegramId, productId);
                const accounts = result.data.accountIds;
                const calc = result.data.calcProd;

                // Filter out errors if any
                const validAccounts = accounts.filter(a => !a.error) as any[]; // TODO: Fix type if needed

                const lines: string[] = [];
                lines.push('🔎 Результаты проверки товара:');
                lines.push('');
                lines.push(`🆔 productId: <code>${productId}</code>`);

                if (calc) {
                    lines.push(`💰 Возможная цена на кассе: <b>${calc.calcPriceForProduct}</b> ₽`);
                    lines.push(`🎯 Требуемые бонусы: <b>${calc.calcBonusForProduct}</b>`);
                }

                if (!validAccounts.length) {
                    lines.push('');
                    lines.push('ℹ️ На данный момент у вас нет аккаунтов с персональной скидкой по этому товару.');
                } else {
                    lines.push('');
                    lines.push(`✅ Найдено ${validAccounts.length} аккаунт(ов) с персональной скидкой.`);
                    lines.push('👇 Топ-10:');
                    lines.push('');

                    const topAccounts = validAccounts.slice(0, 10);
                    for (const acc of topAccounts) {
                        const ordersPart = acc.ordersNumber > 0 ? ` (${acc.ordersNumber})` : '';
                        const hasEnoughBonus = !!(calc && calc.calcBonusForProduct > 0 && acc.bonus >= calc.calcBonusForProduct);
                        const prefix = hasEnoughBonus ? '✅' : '•';
                        lines.push(`${prefix} <code>${acc.accountId}</code>${ordersPart} — бонусов: ${acc.bonus}`);
                    }
                }

                await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
            }
        } catch (e) {
            this.logger.error(`Error while searching products for ${telegramId}`, e as any);
            await ctx.reply('❌ Произошла ошибка при поиске товара. Попробуйте ещё раз чуть позже.');
        }
    }
}
