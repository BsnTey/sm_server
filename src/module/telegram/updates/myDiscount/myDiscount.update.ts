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

@Scene(MY_DISCOUNT_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class MyDiscountUpdate extends BaseUpdate {
    private readonly logger = new Logger(MyDiscountUpdate.name);

    constructor(
        private readonly accountService: AccountService,
        private readonly calculateService: CalculateService,
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
        const productsRaw = products.split('\n');
        const query = product.trim();

        if (!query) {
            await ctx.reply('⚠️ Пожалуйста, пришлите productId, артикул или SKU.');
            return;
        }

        try {
            // 1) Ищем товар по productId / article / sku в нашей БД
            const infoWithProduct = await this.productService.getProductInfoWithProduct({
                productId: query,
                article: query,
                sku: query,
            });

            if (!infoWithProduct) {
                await ctx.reply('❌ Моя скидка не проходит на этот товар, либо данные для поиска не верны');
                return;
            }

            const { productId, article, sku } = infoWithProduct;

            const lines: string[] = [];

            lines.push('🔎 Результаты проверки товара:');
            lines.push('');
            lines.push(`🆔 productId: <code>${productInfo.productId}</code>`);
            if (article) {
                lines.push(`📦 Артикул: <code>${article}</code>`);
            }
            lines.push(`📂 Категория скидки: ${node}`);

            if (percent > 0) {
                lines.push(`💸 Моя скидка: ${percent}%`);
            }

            if (calc) {
                lines.push(`💰 Возможная цена на кассе: <b>${calc.price}</b> ₽`);
                lines.push(`🎯 Требуемые бонусы: <b>${calc.bonus}</b>`);
            }

            if (!accounts.length) {
                lines.push('');
                lines.push('ℹ️ На данный момент у вас нет аккаунтов с персональной скидкой по этому товару (по сохранённым данным).');
                await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
                return;
            }

            const topAccounts = accounts.slice(0, 10);

            lines.push('');
            lines.push(`✅ Найдено ${accounts.length} аккаунт(ов), на которых мы зафиксировали персональную скидку для этого товара.`);
            lines.push('👇 Ниже список первых 10 аккаунтов (нажмите на ID, чтобы скопировать):');
            lines.push('');

            for (const acc of topAccounts) {
                const ordersPart = acc.ordersNumber > 0 ? ` (${acc.ordersNumber})` : '';

                const hasEnoughBonus = !!(calc && calc.bonus > 0 && acc.bonus >= calc.bonus);
                const prefix = hasEnoughBonus ? '✅' : '•';

                lines.push(`${prefix} <code>${acc.accountId}</code>${ordersPart} — бонусов: ${acc.bonus}`);
            }

            await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
        } catch (e) {
            this.logger.error(`Error while searching product "${product}" for ${telegramId}`, e as any);
            await ctx.reply('❌ Произошла ошибка при поиске товара. Попробуйте ещё раз чуть позже.');
        }
    }
}
