import { Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { Logger, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { MY_DISCOUNT_SCENE } from '../../scenes/profile.scene-constant';
import { ALL_KEYS_MENU_BUTTON_NAME } from '../base-command/base-command.constants';
import { BaseUpdate } from '../base/base.update';
import { SenderTelegram } from '../../interfaces/telegram.context';
import { AccountService } from '../../../account/account.service';
import { CheckingService } from '../../../checking/checking.service';

@Scene(MY_DISCOUNT_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class MyDiscountUpdate extends BaseUpdate {
    private readonly logger = new Logger(MyDiscountUpdate.name);

    constructor(
        private readonly accountService: AccountService,
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
        await this.exitScene(menuBtn, ctx);
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

        const isOnlyDigits = (s: string) => /^\d+$/.test(s);

        try {
            // 1. Search for products by variants
            const foundProducts = await this.checkingService.findProductsByQueries(productsRaw);

            // 2. Track which queries were found
            const foundQueries = new Set<string>();
            for (const p of foundProducts) {
                for (const q of productsRaw) {
                    if (p.productId === q || p.sku === q || (p.article && p.article.startsWith(q))) {
                        foundQueries.add(q);
                    }
                }
            }
            // Unfound alphanumeric articles (can search via API)
            const unfoundQueries = productsRaw.filter(q => !foundQueries.has(q) && !isOnlyDigits(q));
            // Unfound numeric productIds (cannot search via API - just report not found)
            const unfoundProductIds = productsRaw.filter(q => !foundQueries.has(q) && isOnlyDigits(q));

            // 3. If nothing found, search via API
            if (!foundProducts.length) {
                const articlesToSearch = productsRaw.filter(q => !isOnlyDigits(q));

                if (articlesToSearch.length > 0) {
                    const suggestions: Array<{ productId: string; name: string }> = [];

                    for (const article of articlesToSearch) {
                        try {
                            const searchResult = await this.accountService.searchProductByAnonym(article);
                            for (const item of searchResult.data.list.slice(0, 5)) {
                                suggestions.push({ productId: item.id, name: item.name });
                            }
                        } catch {
                            this.logger.warn(`Failed to search by article: ${article}`);
                        }
                    }

                    if (suggestions.length > 0) {
                        const lines: string[] = [];
                        lines.push('🔍 <b>Возможно, вы имели в виду:</b>');
                        lines.push('');
                        for (const s of suggestions.slice(0, 10)) {
                            lines.push(`• <code>${s.productId}</code> — ${s.name}`);
                        }
                        lines.push('');
                        lines.push('Пожалуйста, выполните поиск по номеру продукта (цифровому артикулу).');
                        await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
                        return;
                    }
                }

                await ctx.reply('❌ Моя скидка не проходит на этот товар, либо данные для поиска не верны');
                return;
            }

            const productIds = foundProducts.map(p => p.productId);

            // 4. Multiple products - try intersection with total price/bonus
            if (productIds.length > 1) {
                const intersection = await this.checkingService.findAccountsForProductsIntersection(telegramId, productIds);

                // Calculate total price and bonus for all products
                let totalPrice = 0;
                let totalBonus = 0;
                let totalMyDiscount = 0;
                for (const productId of productIds) {
                    try {
                        const result = await this.checkingService.getAccountsForPersonalDiscountV3(telegramId, productId);
                        if (result.data.calcProd) {
                            totalPrice += result.data.calcProd.calcPriceForProduct;
                            totalBonus += result.data.calcProd.calcBonusForProduct;
                            totalMyDiscount += result.data.calcProd.usedMyDiscountRub;
                        }
                    } catch {
                        this.logger.warn(`Failed to get calc for product ${productId}`);
                    }
                }

                if (intersection.accounts.length > 0) {
                    const lines: string[] = [];
                    lines.push('🔎 <b>Результат поиска (пересечение):</b>');
                    lines.push('');
                    lines.push('📦 Товары:');
                    for (const p of foundProducts) {
                        lines.push(`- ${p.article || p.sku || p.productId} (<code>${p.productId}</code>)`);
                    }
                    lines.push('');
                    if (totalPrice > 0) {
                        lines.push(`💰 Общая возможная цена на кассе: <b>${totalPrice}</b> ₽`);
                        lines.push(`🎯 Общие требуемые бонусы: <b>${totalBonus}</b>`);
                        const totalDiscount = totalBonus + totalMyDiscount;
                        lines.push(`💎 Общая скидка (баллы + моя скидка): <b>${totalDiscount}</b> ₽`);
                        lines.push('');
                    }
                    lines.push(`✅ Найдено ${intersection.accounts.length} аккаунт(ов), где есть скидка на ВСЕ эти товары.`);
                    lines.push('👇 Топ-10 аккаунтов:');
                    lines.push('');

                    const topAccounts = intersection.accounts.slice(0, 10);
                    for (const acc of topAccounts) {
                        const ordersPart = acc.ordersNumber > 0 ? ` (${acc.ordersNumber})` : '';
                        const hasEnoughBonus = totalBonus > 0 && acc.bonus >= totalBonus;
                        const prefix = hasEnoughBonus ? '✅' : '•';
                        lines.push(`${prefix} <code>${acc.accountId}</code>${ordersPart} — бонусов: ${acc.bonus}`);
                    }

                    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
                } else {
                    // No intersection found
                    const lines: string[] = [];
                    lines.push('ℹ️ Не найдено аккаунтов с персональной скидкой на ВСЕ указанные товары.');
                    lines.push('');
                    lines.push('📦 Найденные товары:');
                    for (const p of foundProducts) {
                        lines.push(`- ${p.article || p.sku || p.productId} (<code>${p.productId}</code>)`);
                    }
                    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
                }

                // 5. Search unfound articles via API and show suggestions
                if (unfoundQueries.length > 0) {
                    const suggestions: Array<{ productId: string; name: string; query: string }> = [];

                    for (const article of unfoundQueries) {
                        try {
                            const searchResult = await this.accountService.searchProductByAnonym(article);
                            for (const item of searchResult.data.list.slice(0, 3)) {
                                suggestions.push({ productId: item.id, name: item.name, query: article });
                            }
                        } catch {
                            this.logger.warn(`Failed to search by article: ${article}`);
                        }
                    }

                    if (suggestions.length > 0) {
                        const lines: string[] = [];
                        lines.push('');
                        lines.push('⚠️ <b>Не найдено в базе:</b>');
                        for (const q of unfoundQueries) {
                            lines.push(`- ${q}`);
                        }
                        lines.push('');
                        lines.push('🔍 <b>Возможные варианты:</b>');
                        for (const s of suggestions.slice(0, 10)) {
                            lines.push(`• <code>${s.productId}</code> — ${s.name}`);
                        }
                        lines.push('');
                        lines.push('Отправьте повторно все номера продуктов (цифровые артикулы) для полной проверки.');
                        await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
                    } else {
                        const lines: string[] = [];
                        lines.push('');
                        lines.push('⚠️ <b>Не найдено:</b>');
                        for (const q of unfoundQueries) {
                            lines.push(`- ${q}`);
                        }
                        await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
                    }
                }

                // Show message for unfound numeric productIds
                if (unfoundProductIds.length > 0) {
                    const lines: string[] = [];
                    lines.push('❌ <b>Моя скидка не проходит на товар(ы):</b>');
                    for (const pid of unfoundProductIds) {
                        lines.push(`- <code>${pid}</code>`);
                    }
                    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
                }

                return;
            }

            // 6. Single product - show detailed results
            for (const productInfo of foundProducts) {
                const { productId } = productInfo;

                const result = await this.checkingService.getAccountsForPersonalDiscountV3(telegramId, productId);
                const accounts = result.data.accountIds;
                const calc = result.data.calcProd;

                // Deduplicate accounts by accountId
                const validAccounts = [...new Map(accounts.filter(a => !a.error).map(a => [a.accountId, a])).values()];
                const errorAccounts = accounts.filter(a => a.error);

                const lines: string[] = [];
                lines.push('🔎 Результаты проверки товара:');
                lines.push('');
                lines.push(`🆔 productId: <code>${productId}</code>`);

                if (calc) {
                    lines.push(`💰 Возможная цена на кассе: <b>${calc.calcPriceForProduct}</b> ₽`);
                    lines.push(`🎯 Требуемые бонусы: <b>${calc.calcBonusForProduct}</b>`);
                    const totalDiscount = calc.calcBonusForProduct + calc.usedMyDiscountRub;
                    lines.push(`💎 Общая скидка (баллы + моя скидка): <b>${totalDiscount}</b> ₽`);
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
                        const ordersPart = Boolean(acc.info?.ordersToday) ? ` (${acc.info?.ordersToday})` : '';
                        const hasEnoughBonus = !!(
                            calc &&
                            calc.calcBonusForProduct > 0 &&
                            (acc.info?.bonusesOnAccount ?? 0) >= calc.calcBonusForProduct
                        );
                        const prefix = hasEnoughBonus ? '✅' : '•';
                        lines.push(`${prefix} <code>${acc.accountId}</code>${ordersPart} — бонусов: ${acc.info?.bonusesOnAccount}`);
                    }
                }

                // Показываем ошибки аккаунтов
                if (errorAccounts.length > 0) {
                    lines.push('');
                    lines.push(`⚠️ Ошибки на ${errorAccounts.length} аккаунт(ах):`);
                    for (const acc of errorAccounts.slice(0, 5)) {
                        lines.push(`• <code>${acc.accountId}</code> — ${acc.error}`);
                    }
                    if (errorAccounts.length > 5) {
                        lines.push(`... и ещё ${errorAccounts.length - 5}`);
                    }
                }

                await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
            }

            // 7. Show suggestions for unfound articles (single product case)
            if (unfoundQueries.length > 0) {
                const suggestions: Array<{ productId: string; name: string }> = [];

                for (const article of unfoundQueries) {
                    try {
                        const searchResult = await this.accountService.searchProductByAnonym(article);
                        for (const item of searchResult.data.list.slice(0, 3)) {
                            suggestions.push({ productId: item.id, name: item.name });
                        }
                    } catch {
                        this.logger.warn(`Failed to search by article: ${article}`);
                    }
                }

                if (suggestions.length > 0) {
                    const lines: string[] = [];
                    lines.push('');
                    lines.push('⚠️ <b>Не найдено в базе:</b>');
                    for (const q of unfoundQueries) {
                        lines.push(`- ${q}`);
                    }
                    lines.push('');
                    lines.push('🔍 <b>Возможные варианты:</b>');
                    for (const s of suggestions.slice(0, 10)) {
                        lines.push(`• <code>${s.productId}</code> — ${s.name}`);
                    }
                    lines.push('');
                    lines.push('Отправьте повторно все номера продуктов (цифровые артикулы) для полной проверки.');
                    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
                } else {
                    const lines: string[] = [];
                    lines.push('');
                    lines.push('⚠️ <b>Не найдено:</b>');
                    for (const q of unfoundQueries) {
                        lines.push(`- ${q}`);
                    }
                    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
                }
            }

            // 8. Show message for unfound numeric productIds
            if (unfoundProductIds.length > 0) {
                const lines: string[] = [];
                lines.push('❌ <b>Моя скидка не проходит на товар(ы):</b>');
                for (const pid of unfoundProductIds) {
                    lines.push(`- <code>${pid}</code>`);
                }
                await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
            }
        } catch (e) {
            this.logger.error(`Error while searching products for ${telegramId}`, e as any);
            await ctx.reply('❌ Произошла ошибка при поиске товара. Попробуйте ещё раз чуть позже.');
        }
    }
}
