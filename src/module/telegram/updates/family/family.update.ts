import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { HttpException, Logger, NotFoundException, UseFilters } from '@nestjs/common';
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
import { BottPurchaseService } from '../../../bott/bott-purchase.service';
import { wantToBuyAcessKeyboard } from '../../keyboards/family.keyboard';
import { PaymentService } from '../../../payment/payment.service';

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
        await this.telegramService.setTelegramAccountCache(String(sender.id), accountId);
        await ctx.scene.enter(FAMILY_INPUT_SCENE);
    }
}

@Scene(FAMILY_INPUT_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class FamilyInputAccountUpdate extends BaseUpdate {
    private readonly logger = new Logger(FamilyInputAccountUpdate.name);
    constructor(private readonly familyService: FamilyService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        const telegramId = String(sender.id);
        const accountId = await this.familyService.getAccountIdByTelegram(telegramId);
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        this.logger.log(`Пользователь ${sender.first_name} - ${sender.id} вошел в сцену семьи`);

        try {
            if (user.role == UserRole.User) {
                const { text, keyboard } = await this.familyService.getFamilyViewUser(accountId);
                await ctx.reply(text, keyboard);
            } else {
                const { text, keyboard } = await this.familyService.getFamilyView(accountId, user.role);
                await ctx.reply(text, keyboard);
            }
        } catch (e: any) {
            await ctx.reply('❌ Что то пошло не так при проверке профиля. Попробуйте заново');
        }
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }

    @Action('refresh_info_family')
    async refreshInfoFamily(@Ctx() ctx: WizardContext, @Sender() sender: SenderTelegram) {
        this.logger.log(`Пользователь ${sender.first_name} - ${sender.id} запросил обновить статус семьи`);
        try {
            await ctx.deleteMessage();
        } catch (e: any) {}
        await ctx.scene.reenter();
    }

    @Action(/exclude_\d+_\d+/)
    async excludeFromFamily(@Ctx() ctx: WizardContext, @Sender() sender: SenderTelegram) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const [, familyId, memberId] = ctx.match[0].split('_');

        const telegramId = String(sender.id);
        const accountId = await this.familyService.getAccountIdByTelegram(telegramId);

        this.logger.log(`Пользователь ${sender.first_name} - ${sender.id} запросил исключить из семьи accountId ${accountId}`);

        try {
            await this.familyService.excludeMemberFamily(accountId, { familyId, memberId });
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
        const accountId = await this.familyService.getAccountIdByTelegram(telegramId);

        this.logger.log(`Пользователь ${sender.first_name} - ${sender.id} запросил развалить семью для accountId ${accountId}`);

        try {
            await this.familyService.leaveFamily(accountId);
            await ctx.deleteMessage();
            await ctx.reply('👜 Вы ушли за хлебом');
        } catch (e: any) {
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
        const accountId = await this.familyService.getAccountIdByTelegram(telegramId);

        this.logger.log(
            `Пользователь ${sender.first_name} - ${sender.id} запросил подтвердить его приглашение в семью для accountId ${accountId}`,
        );
        try {
            await this.familyService.answerInvite(accountId, true);
            await ctx.deleteMessage();
            await ctx.reply('✅ Приглашение принято. Проверьте свой аккаунт');
            await ctx.scene.leave();
            const user = await this.userService.getUserByTelegramId(String(telegramId));
            await ctx.reply('Главное меню', getMainMenuKeyboard(user!.role));
        } catch (e: any) {
            await ctx.reply('❌ Что то пошло не так при подтверждении');
            return ctx.scene.reenter();
        }
    }

    @Action('reject_family')
    async onReject(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        const telegramId = String(sender.id);
        const accountId = await this.familyService.getAccountIdByTelegram(telegramId);

        this.logger.log(
            `Пользователь ${sender.first_name} - ${sender.id} запросил отклонить его приглашение из семьи для accountId ${accountId}`,
        );

        try {
            await this.familyService.answerInvite(accountId, false);
            await ctx.deleteMessage();
            await ctx.reply('🚫 Приглашение отклонено');
            await ctx.scene.reenter();
        } catch (e: any) {
            await ctx.reply('❌ Что то пошло не так при отклонении');
            return ctx.scene.reenter();
        }
    }
}

@Scene(FAMILY_INVITE_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class FamilyInviteUpdate extends BaseUpdate {
    private readonly logger = new Logger(FamilyInviteUpdate.name);

    private defaultDebitMoneyForFamily = 50;

    constructor(
        private readonly familyService: FamilyService,
        private readonly bottPurchaseService: BottPurchaseService,
        private readonly paymentService: PaymentService,
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
        @Message('text', new isAccountIdPipe()) accountIdInvited: string,
        @Sender() sender: SenderTelegram,
    ) {
        const telegramId = String(sender.id);

        const user = await this.userService.getUserByTelegramId(telegramId);
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        try {
            if (user.role == UserRole.User || user.role == UserRole.Admin) {
                await this.doInvited(ctx, sender, accountIdInvited, user.role);
            }
            if (user.role == UserRole.Seller) {
                const access = await this.checkingAccessOrPay(accountIdInvited);

                await this.telegramService.sendAdminMessage(
                    `${user.role} ${sender.first_name || sender.username} пытается склеить с ${accountIdInvited} его уровень доступа ${access}`,
                );

                if (access == null) {
                    //await ctx.reply('❌ Нет информации о дате покупки');
                    await ctx.reply(
                        `❓ Вышел срок бесплатного обьединения. Стоимость ${this.defaultDebitMoneyForFamily}р`,
                        wantToBuyAcessKeyboard(accountIdInvited),
                    );
                    return;
                }
                if (!access) {
                    await ctx.reply(
                        `❓ Вышел срок бесплатного обьединения. Стоимость ${this.defaultDebitMoneyForFamily}р`,
                        wantToBuyAcessKeyboard(accountIdInvited),
                    );
                } else {
                    await this.doInvited(ctx, sender, accountIdInvited, user.role);
                }
            }
            return;
        } catch (e: any) {
            await ctx.reply(e.message);
        }
    }

    @Action(/^buy_access_([0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12})$/)
    async buyAccess(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const accountIdInvited = ctx.match?.[1];
        const telegramId = String(sender.id);
        const user = await this.userService.getUserByTelegramId(telegramId);
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        await this.telegramService.sendAdminMessage(
            `Пользователь ${sender.first_name || sender.username} согласился купить доступ в семью для ${accountIdInvited}`,
        );

        let userBott;
        try {
            userBott = await this.paymentService.getUserByTelegramId(telegramId);
        } catch (e) {
            throw e;
        }
        if (userBott.balance < this.defaultDebitMoneyForFamily) {
            await ctx.reply('❌ Пополните баланс');
            return;
        }

        let success = false;
        try {
            success = await this.doInvited(ctx, sender, accountIdInvited, user.role);
        } catch (e) {
            throw e;
        }
        try {
            if (success) {
                await this.paymentService.userBalanceEdit(userBott.userBotId, String(this.defaultDebitMoneyForFamily), false);
                await ctx.reply(`С баланса вычтено ${this.defaultDebitMoneyForFamily}р`);
            }
        } catch (e) {
            await this.telegramService.sendAdminMessage(
                `Ошибка изменения баланса за семью. Вычти у ${telegramId} ${this.defaultDebitMoneyForFamily}р`,
            );
        }
    }

    private async checkingAccessOrPay(accountId: string): Promise<boolean | null> {
        const lastPurchaseAccountIdInvited = await this.bottPurchaseService.getLastPurchaseByAccountId(accountId);

        if (!lastPurchaseAccountIdInvited) {
            return null;
        }

        const purchaseDate = new Date(lastPurchaseAccountIdInvited.purchasedAt);
        const now = new Date();

        const diffMs = now.getTime() - purchaseDate.getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        return diffMs <= oneDayMs;
    }

    private async doInvited(ctx: Context, sender: SenderTelegram, accountIdInvited: string, userRole: UserRole) {
        let success = false;
        const accountIdOwner = await this.familyService.getAccountIdByTelegram(String(sender.id));

        this.logger.log(`Пользователь ${sender.first_name} - ${sender.id} запросил принять его в семью по accountId ${accountIdOwner}`);

        let namePhoneInvited;
        try {
            namePhoneInvited = await this.familyService.getProfileNamePhone(accountIdInvited);
        } catch (e) {
            if (e instanceof NotFoundException || e instanceof HttpException) {
                throw e;
            }
            throw new Error('Что то пошло не так при поиске приглашаемого участника');
        }
        try {
            await this.familyService.inviteMember(accountIdOwner, namePhoneInvited);
            success = true;
        } catch (e: any) {
            throw new Error(e?.message || 'Что то пошло не так при добавлении участника');
        }

        await ctx.reply('✅ Приглашение выслано. Проверьте информацию');
        await ctx.scene.leave();

        await ctx.reply('Главное меню', getMainMenuKeyboard(userRole));
        return success;
    }
}
