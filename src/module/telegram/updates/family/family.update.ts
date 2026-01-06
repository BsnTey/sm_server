import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { Logger, NotFoundException, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { Context, SenderTelegram } from '../../interfaces/telegram.context';
import { WizardContext } from 'telegraf/typings/scenes';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { FAMILY_INPUT_SCENE, FAMILY_INVITE_SCENE, FAMILY_PRIVELEGIE, FAMILY_USER } from '../../scenes/family.scene';
import { FamilyService } from './family.service';
import { BaseUpdate } from '../base/base.update';
import { ALL_KEYS_MENU_BUTTON_NAME, FAMILY } from '../base-command/base-command.constants';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { ERROR_ACCESS, ERROR_FOUND_USER } from '../../constants/error.constant';
import { UserRole } from '@prisma/client';
import { RedisCacheService } from '../../../cache/cache.service';
import { InviteAccessType } from './interfaces/status.interface';
import { InviteAccessService } from './invite-access.service';
import { isAccessPayFamilyKeyboard, payFamilyKeyboard } from '../../keyboards/family.keyboard';
import { familyCacheKey } from '../../cashe-key/keys';
import { FamilyAccountCashe } from './interfaces/cashe.interface';
import { FamilyPurchaseService } from './family-purchase.service';

const FAMILY_TTL = 3600;

@Scene(FAMILY_PRIVELEGIE)
@UseFilters(TelegrafExceptionFilter)
export class FamilyPrivelegieUpdate extends BaseUpdate {
    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        await this.createOrUpdateUserTelegram(sender.first_name, sender.id);

        const telegramId = String(sender.id);
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);
        if (user?.role == UserRole.User) throw new NotFoundException(ERROR_ACCESS);

        await ctx.scene.enter(FAMILY.scene);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }
}

@Scene(FAMILY_USER)
@UseFilters(TelegrafExceptionFilter)
export class FamilyUserUpdate extends BaseUpdate {
    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        await this.createOrUpdateUserTelegram(sender.first_name, sender.id);

        const telegramId = String(sender.id);
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);
        if (user?.role == UserRole.Seller) throw new NotFoundException(ERROR_ACCESS);

        await ctx.scene.enter(FAMILY.scene);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }
}

@Scene(FAMILY.scene)
@UseFilters(TelegrafExceptionFilter)
export class FamilyUpdate extends BaseUpdate {
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
        await this.cacheService.set<FamilyAccountCashe>(
            familyCacheKey(sender.id),
            { ownerAccountId: accountId, invitedAccountId: '', price: 0, bonus: 0 },
            FAMILY_TTL,
        );
        await ctx.scene.enter(FAMILY_INPUT_SCENE);
    }
}

@Scene(FAMILY_INPUT_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class FamilyInputAccountUpdate extends BaseUpdate {
    private readonly logger = new Logger(FamilyInputAccountUpdate.name);
    constructor(
        private readonly familyService: FamilyService,
        private cacheService: RedisCacheService,
    ) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        const telegramId = String(sender.id);
        const account = await this.cacheService.get<FamilyAccountCashe>(familyCacheKey(telegramId));
        const ownerAccountId = account?.ownerAccountId;
        if (!ownerAccountId) throw new NotFoundException('Информация устарела. Попробуйте заново');

        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        try {
            if (user.role == UserRole.User) {
                const { text, keyboard } = await this.familyService.getFamilyViewUser(ownerAccountId);
                await ctx.reply(text, keyboard);
            } else {
                const { text, keyboard } = await this.familyService.getFamilyView(ownerAccountId, user.role);
                await ctx.reply(text, keyboard);
            }
        } catch {
            await ctx.reply('❌ Что то пошло не так при проверке профиля. Попробуйте заново');
        }
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @Action('refresh_info_family')
    async refreshInfoFamily(@Ctx() ctx: WizardContext) {
        try {
            await ctx.deleteMessage();
        } catch {
            //ignore
        }
        await ctx.scene.reenter();
    }

    @Action(/exclude_\d+_\d+/)
    async excludeFromFamily(@Ctx() ctx: WizardContext, @Sender() sender: SenderTelegram) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const [, familyId, memberId] = ctx.match[0].split('_');

        const telegramId = String(sender.id);
        const account = await this.cacheService.get<FamilyAccountCashe>(familyCacheKey(telegramId));
        const ownerAccountId = account?.ownerAccountId;
        if (!ownerAccountId) throw new NotFoundException('Информация устарела. Попробуйте заново');

        this.logger.log(`Пользователь ${sender.first_name} - ${sender.id} запросил исключить из семьи accountId ${ownerAccountId}`);

        try {
            await this.familyService.excludeMemberFamily(ownerAccountId, { familyId, memberId });
            await ctx.deleteMessage();
            await ctx.reply('😢 Он ушел от нас');
        } catch (e: any) {
            await ctx.deleteMessage();
            if (e instanceof NotFoundException) {
                await ctx.reply(`❌ ${e.message}`);
            } else {
                await ctx.reply('❌ Что то пошло не так при выходе из семьи');
            }
        } finally {
            await ctx.scene.reenter();
        }
    }

    @Action('leave_family')
    async leaveFamily(@Ctx() ctx: WizardContext, @Sender() sender: SenderTelegram) {
        const telegramId = String(sender.id);
        const account = await this.cacheService.get<FamilyAccountCashe>(familyCacheKey(telegramId));
        const ownerAccountId = account?.ownerAccountId;
        if (!ownerAccountId) throw new NotFoundException('Информация устарела. Попробуйте заново');

        this.logger.log(`Пользователь ${sender.first_name} - ${sender.id} запросил развалить семью для accountId ${ownerAccountId}`);

        try {
            await this.familyService.leaveFamily(ownerAccountId);
            await ctx.deleteMessage();
            await ctx.reply('👜 Вы ушли за хлебом');
        } catch {
            await ctx.deleteMessage();
            await ctx.reply('❌ Что то пошло не так при выходе из семьи');
        } finally {
            await ctx.scene.reenter();
        }
    }

    @Action('invite_member')
    async inviteMemberIntoFamily(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(FAMILY_INVITE_SCENE);
    }

    @Action('accept_family')
    async onAccept(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        const telegramId = String(sender.id);
        const account = await this.cacheService.get<FamilyAccountCashe>(familyCacheKey(telegramId));
        const ownerAccountId = account?.ownerAccountId;
        if (!ownerAccountId) throw new NotFoundException('Информация устарела. Попробуйте заново');

        const user = await this.userService.getUserByTelegramId(String(telegramId));

        this.logger.log(
            `Пользователь ${sender.first_name} - ${sender.id} запросил подтвердить его приглашение в семью для accountId ${ownerAccountId}`,
        );
        try {
            await this.familyService.answerInvite(ownerAccountId, true);
            await ctx.deleteMessage();
            await ctx.reply('✅ Приглашение принято. Проверьте свой аккаунт', getMainMenuKeyboard(user!.role));
            await ctx.scene.leave();
        } catch {
            await ctx.reply('❌ Что то пошло не так при подтверждении');
            return ctx.scene.reenter();
        }
    }

    @Action('reject_family')
    async onReject(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        const telegramId = String(sender.id);
        const account = await this.cacheService.get<FamilyAccountCashe>(familyCacheKey(telegramId));
        const ownerAccountId = account?.ownerAccountId;
        if (!ownerAccountId) throw new NotFoundException('Информация устарела. Попробуйте заново');

        this.logger.log(
            `Пользователь ${sender.first_name} - ${sender.id} запросил отклонить его приглашение из семьи для accountId ${ownerAccountId}`,
        );

        try {
            await this.familyService.answerInvite(ownerAccountId, false);
            await ctx.deleteMessage();
            await ctx.reply('🚫 Приглашение отклонено');
            await ctx.scene.reenter();
        } catch {
            await ctx.reply('❌ Что то пошло не так при отклонении');
            return ctx.scene.reenter();
        }
    }
}

@Scene(FAMILY_INVITE_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class FamilyInviteUpdate extends BaseUpdate {
    private readonly logger = new Logger(FamilyInviteUpdate.name);

    constructor(
        private readonly familyService: FamilyService,
        private readonly inviteAccessService: InviteAccessService,
        private readonly familyPurchaseService: FamilyPurchaseService,
        private readonly cacheService: RedisCacheService,
    ) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context) {
        await ctx.reply('Пришлите номер аккаунта, с которым хотите обьеденить');
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @Hears(/^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/i)
    async inputAccountIdInvitedMember(
        @Ctx() ctx: Context,
        @Message('text', new isAccountIdPipe()) invitedAccountId: string,
        @Sender() sender: SenderTelegram,
    ) {
        const telegramId = String(sender.id);

        const account = await this.cacheService.get<FamilyAccountCashe>(familyCacheKey(telegramId));
        const ownerAccountId = account?.ownerAccountId;
        if (!ownerAccountId) throw new NotFoundException('Информация устарела. Попробуйте заново');

        const user = await this.userService.getUserByTelegramId(telegramId);
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        try {
            await this.familyService.checkOnValidFamily(invitedAccountId);

            switch (user.role) {
                case UserRole.User: {
                    await this.familyService.doInvite(ownerAccountId, invitedAccountId);

                    await ctx.reply('✅ Приглашение выслано. Проверьте информацию');
                    await ctx.scene.leave();

                    await ctx.reply('Главное меню', getMainMenuKeyboard(UserRole.User));
                    return;
                }
                case UserRole.Admin: {
                    await this.familyService.doInvite(ownerAccountId, invitedAccountId);
                    await this.gotToFamilyInput(ctx, telegramId, invitedAccountId);
                    return;
                }
                case UserRole.Seller: {
                    const res = await this.inviteAccessService.resolve(invitedAccountId);

                    switch (res.type) {
                        case InviteAccessType.DENIED:
                            await ctx.reply(`❌ ${res.reason}`);
                            return;

                        case InviteAccessType.ERROR:
                            await ctx.reply(`❌ ${res.reason}`);
                            return;

                        case InviteAccessType.FREE:
                            await this.familyService.doInvite(ownerAccountId, invitedAccountId);
                            if (res.reason) await ctx.reply(`✅ ${res.reason}`);
                            this.telegramService
                                .sendAdminMessage(`${sender.first_name || sender.username} бесплатно клеит для ${invitedAccountId}}`)
                                .then();

                            await this.gotToFamilyInput(ctx, telegramId, invitedAccountId);
                            return;

                        case InviteAccessType.PAID: {
                            const updatedAccount: FamilyAccountCashe = {
                                ownerAccountId,
                                invitedAccountId,
                                price: res.priceRub,
                                bonus: res.bonusBalance,
                            };

                            await ctx.reply(
                                `💳 Доступ платный.\n💸 Бонусов: ${res.bonusBalance}\n💵 Цена: ${res.priceRub}₽\n💰 ${res.reason}`,
                                payFamilyKeyboard,
                            );

                            await this.cacheService.set<FamilyAccountCashe>(familyCacheKey(telegramId), updatedAccount, FAMILY_TTL);
                            return;
                        }
                    }
                }
            }
        } catch (e: any) {
            await ctx.reply(e.message);
        }
    }

    @Action('buy_access_family')
    async buyAccessFamily(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        const account = await this.cacheService.get<FamilyAccountCashe>(familyCacheKey(sender.id));
        const ownerAccountId = account?.ownerAccountId;
        const invitedAccountId = account?.invitedAccountId;
        if (!ownerAccountId || !invitedAccountId) throw new NotFoundException('Информация устарела. Попробуйте заново');

        const { price, bonus } = account;

        this.logger.log(`Пользователь ${sender.first_name} - ${sender.id} запросил обновить доступ для accountId ${invitedAccountId}`);

        await ctx.editMessageText(
            `❗️ Стоимость обновления доступа ${price}р за ${bonus} баллов. Будут списаны с баланса бота.`,
            isAccessPayFamilyKeyboard,
        );
    }

    @Action('access_pay_family')
    async accessPayFamily(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        await ctx.deleteMessage();
        const telegramId = sender.id.toString();
        const account = await this.cacheService.get<FamilyAccountCashe>(familyCacheKey(telegramId));
        const ownerAccountId = account?.ownerAccountId;
        const invitedAccountId = account?.invitedAccountId;
        const amount = account?.price;
        if (!ownerAccountId || !invitedAccountId || !amount) throw new NotFoundException('Информация устарела. Попробуйте заново');

        await ctx.reply('⏳ Обработка платежа...');

        try {
            await this.familyPurchaseService.processFamilyInvitePurchase(telegramId, ownerAccountId, invitedAccountId, amount);

            await ctx.reply('✅ Оплата прошла успешно, приглашение отправлено.');

            await this.telegramService.sendAdminMessage(
                `💰 <b>Продажа!</b>\nSeller: ${sender.first_name}\nSum: ${amount}р\nAccount: ${invitedAccountId}`,
            );

            await this.gotToFamilyInput(ctx, telegramId, invitedAccountId);
        } catch (e: any) {
            await this.telegramService.sendAdminMessage(
                `💸 <b>Ошибка оплаты/выдачи</b>\n` +
                    `Seller: ${sender.username}\n` +
                    `Account: ${invitedAccountId}\n` +
                    `Error: ${e.message}`,
            );

            await ctx.reply(`❌ Не удалось завершить операцию: ${e.message}`);
            await ctx.scene.leave();
        }
    }

    private async gotToFamilyInput(ctx: Context, telegramId: string, invitedAccountId: string) {
        const updatedAccount: FamilyAccountCashe = {
            ownerAccountId: invitedAccountId,
            invitedAccountId: '',
            price: 0,
            bonus: 0,
        };

        await this.cacheService.set<FamilyAccountCashe>(familyCacheKey(telegramId), updatedAccount, FAMILY_TTL);

        await ctx.scene.enter(FAMILY_INPUT_SCENE);
    }
}
