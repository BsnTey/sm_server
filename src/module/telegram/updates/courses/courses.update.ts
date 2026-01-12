import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { ALL_KEYS_MENU_BUTTON_NAME } from '../base-command/base-command.constants';
import { NotFoundException, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { COURSES_SCENE, GET_COURSES_SCENE } from '../../scenes/profile.scene-constant';
import { BaseUpdate } from '../base/base.update';
import { RedisCacheService } from '../../../cache/cache.service';
import { Context, SenderTelegram } from '../../interfaces/telegram.context';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { coursesCacheKey } from '../../cashe-key/keys';
import { CourseWorkService } from '../../../courses/courses.service';
import { getAvailableRanges, getOptionsInSpecificRange, RANGE_STEP } from '../../../courses/utils';
import { CoursePurchaseService } from '../../../courses/course-purchase.service';
import { ERROR_ACCESS, ERROR_FOUND_USER } from '../../constants/error.constant';
import { UserRole } from '@prisma/client';

const TTL_COURSES = 3600;

// --- Сцена ввода аккаунта (без изменений, кроме перехода) ---
@Scene(COURSES_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class CoursesUpdate extends BaseUpdate {
    constructor(private cacheService: RedisCacheService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context) {
        await ctx.reply('🔑 Пришлите номер вашего аккаунта:');
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @On('text')
    async findAccount(
        @Message('text', new isAccountIdPipe()) accountId: string,
        @Sender() sender: SenderTelegram,
        @Ctx() ctx: WizardContext,
    ) {
        await this.cacheService.set(coursesCacheKey(sender.id), { accountId }, TTL_COURSES);
        await ctx.scene.enter(GET_COURSES_SCENE);
    }
}

@Scene(GET_COURSES_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class GetCoursesUpdate extends BaseUpdate {
    constructor(
        private cacheService: RedisCacheService,
        private courseWorkService: CourseWorkService,
        private coursePurchaseService: CoursePurchaseService,
    ) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        const session = await this.cacheService.get<{ accountId: string }>(coursesCacheKey(sender.id));
        if (!session) throw new NotFoundException('Информация устарела. Попробуйте заново');

        try {
            const analytics = await this.courseWorkService.getCourseAnalytics(session.accountId);

            const message =`🟢 <b>Доступно к зачислению:</b> ${analytics.totalEarned}\n🟡 <b>Будущий потенциал:</b> ${analytics.totalFuture}`;

            await ctx.reply(message,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('💰 Зачислить сейчас', 'credit_now')],
                        // [Markup.button.callback('🚀 Поставить в работу', 'start_work')]
                    ])
                }
            );
        } catch (e) {
            await ctx.reply('Ошибка при расчете данных.');
        }
    }

    /**
     * Обработка нажатия "Поставить в работу"
     */
    // @Action('start_work')
    // async onStartWork(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
    //     const session = await this.cacheService.get<{ accountId: string }>(coursesCacheKey(sender.id));
    //     if (!session) throw new NotFoundException('Информация устарела. Попробуйте заново');
    //
    //     const count = await this.courseWorkService.startWorkFlow(session.accountId);
    //
    //     await ctx.answerCbQuery('Задачи отправлены');
    //     await ctx.reply(`✅ <b>${count} курсов</b> поставлено в очередь на прохождение (RabbitMQ).\nПроцесс займет некоторое время.`);
    // }

    /**
     * ШАГ 1: Показываем категории (диапазоны)
     */
    @Action('credit_now')
    async onCreditNow(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        const session = await this.cacheService.get<{ accountId: string }>(coursesCacheKey(sender.id));
        if (!session) throw new NotFoundException('Информация устарела. Попробуйте заново');

        // 1. Получаем все возможные комбинации (например: 300, 500 ... 5400)
        const allOptions = await this.courseWorkService.getCreditOptions(session.accountId);

        if (allOptions.length === 0) {
            return ctx.reply('Нет доступных баллов для зачисления.');
        }

        // 2. Определяем доступные диапазоны
        // Если есть сумма 5400, будут кнопки: [1000, 2000, 3000, 4000, 5000, 6000]
        const rangeLimits = getAvailableRanges(allOptions);

        // 3. Формируем кнопки категорий
        const buttons = rangeLimits.map(limit => {
            const prev = limit - RANGE_STEP;
            // Текст: "от 0 до 1000", "от 1000 до 2000"
            return Markup.button.callback(
                `${prev} - ${limit}`,
                `select_range_${limit}`
            );
        });

        // Разбиваем по 2 кнопки в ряд для красоты
        const keyboardRows = [];
        for (let i = 0; i < buttons.length; i += 2) {
            keyboardRows.push(buttons.slice(i, i + 2));
        }
        keyboardRows.push([Markup.button.callback('🔙 Отмена', 'back_to_analytics')]);

        await ctx.editMessageText(
            `💰 <b>Выберите диапазон зачисления:</b>\nДоступно максимум: <b>${Math.max(...allOptions)}</b>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(keyboardRows)
            }
        );
    }

    /**
     * ШАГ 2: Показываем конкретные суммы внутри диапазона
     */
    @Action(/select_range_(\d+)/)
    async onRangeSelect(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        // @ts-ignore
        const rangeMax = parseInt(ctx.match[1], 10);
        const session = await this.cacheService.get<{ accountId: string }>(coursesCacheKey(sender.id));
        if (!session) throw new NotFoundException('Информация устарела. Попробуйте заново');

        // Снова получаем опции (или берем из кэша, если он есть)
        const allOptions = await this.courseWorkService.getCreditOptions(session.accountId);

        // Фильтруем: берем только те, что входят в выбранный диапазон
        // Например, нажали 3000 -> показываем [2100, 2300, 2500 ... 3000]
        const filteredOptions = getOptionsInSpecificRange(allOptions, rangeMax);

        // Создаем кнопки с суммами
        const buttons = filteredOptions.map(amount =>
            Markup.button.callback(`${amount} б.`, `credit_amount_${amount}`)
        );

        // Группируем по 3 в ряд
        const keyboardRows = [];
        for (let i = 0; i < buttons.length; i += 3) {
            keyboardRows.push(buttons.slice(i, i + 3));
        }
        // Кнопка "Назад" возвращает к выбору диапазонов
        keyboardRows.push([Markup.button.callback('🔙 К диапазонам', 'credit_now')]);

        const rangeMin = rangeMax - RANGE_STEP;
        await ctx.editMessageText(
            `🎯 Выберите точную сумму (от ${rangeMin} до ${rangeMax}):`,
            Markup.inlineKeyboard(keyboardRows)
        );
    }

    /**
     * ШАГ 3: Выбор суммы -> Предложение оплаты
     */
    @Action(/credit_amount_(\d+)/)
    async onCreditAmountSelect(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        // @ts-ignore
        const amountPoints = parseInt(ctx.match[1], 10);

        // Сохраняем выбранную сумму в сессию, чтобы не потерять при переходе к оплате
        const sessionKey = coursesCacheKey(sender.id);
        const session = await this.cacheService.get<any>(sessionKey);
        await this.cacheService.set(sessionKey, { ...session, selectedAmount: amountPoints }, TTL_COURSES);

        const user = await this.userService.getUserByTelegramId(String(sender.id));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        // Считаем цену
        const price = this.coursePurchaseService.calculatePrice(amountPoints, user.role);

        if (price === 0) {
            // Если админ или цена 0 — сразу выполняем
            return this.executePurchase(ctx, sender.id, session.accountId, amountPoints);
        }

        // Показываем инвойс/кнопку оплаты
        await ctx.editMessageText(
            `💳 <b>Подтверждение операции</b>\n\n` +
            `🎯 Начисление: <b>${amountPoints} баллов</b>\n` +
            `💵 Стоимость: <b>${price}₽</b> (5%)\n\n` +
            `Деньги будут списаны с баланса бота.`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(`✅ Оплатить ${price}₽`, 'confirm_pay_courses')],
                    [Markup.button.callback('🔙 Назад к выбору', 'credit_now')]
                ])
            }
        );
    }

    /**
     * ШАГ 4: Подтверждение оплаты и выполнение
     */
    @Action('confirm_pay_courses')
    async onPayConfirm(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        const session = await this.cacheService.get<any>(coursesCacheKey(sender.id));
        if (!session || !session.selectedAmount) {
            return ctx.reply('⏳ Сессия истекла. Начните заново.');
        }

        await ctx.deleteMessage();
        await ctx.reply('⏳ Ожидайте выполнения');

        try {
            // Вызываем сервис покупки
            const { earnedPoints } = await this.coursePurchaseService.processCoursePurchase(
                String(sender.id),
                session.accountId,
                session.selectedAmount
            );

            let msg = `✅ <b>Выполнено!</b>\n`;
            msg += `Получено баллов: ${earnedPoints}\n`;
            msg += `Ожидайте пару минут на зачисление`;

            if (earnedPoints < session.selectedAmount) {
                msg += `\n\n⚠️ <i>Часть не удалось начислить. Разница в стоимости возвращена на баланс.</i>`;
            }

            await ctx.reply(
                msg,
                { parse_mode: 'HTML' }
            );

            await this.telegramService.sendAdminMessage(
                `💰 Продажа курсов!\nSeller: ${sender.first_name}\nБаллы: ${session.selectedAmount}\nАккаунт: ${session.accountId}`,
            );

        } catch (e: any) {
            await ctx.reply(
                `❌ <b>Ошибка:</b> ${e.message}`,
                { parse_mode: 'HTML' }
            );

            await this.telegramService.sendAdminMessage(
                `❌ Ошибка на курсах\n` +
                `Seller: ${sender.username}\n` +
                `Account: ${session.accountId}\n` +
                `Error: ${e.message}`,
            );
        }
    }

    // Хелпер для запуска без оплаты (для админов)
    private async executePurchase(ctx: Context, tgId: number, accountId: string, amount: number) {
        try {
            const count = await this.coursePurchaseService.processCoursePurchase(String(tgId), accountId, amount);
            await ctx.reply(`✅ Готово! Пройдено курсов: ${count}`);
        } catch (e: any) {
            await ctx.reply(`❌ Ошибка: ${e.message}`);
        }
    }

    @Action('back_to_analytics')
    async onBack(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        // Просто перезапускаем вход в сцену
        await ctx.deleteMessage();
        await this.onSceneEnter(ctx, sender);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }
}