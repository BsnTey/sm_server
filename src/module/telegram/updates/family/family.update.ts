import { Action, Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { HttpException, Logger, NotFoundException, UseFilters } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { Context, SenderTelegram } from '../../interfaces/telegram.context';
import { WizardContext } from 'telegraf/typings/scenes';
import { isAccountIdPipe } from '../../pipes/isAccountId.pipe';
import { FAMILY_INPUT_SCENE, FAMILY_INVITE_SCENE } from '../../scenes/family.scene';
import { PhoneName } from '../../interfaces/person.interface';
import { isPhoneNamePipe } from '../../pipes/isPhone.pipe';
import { FamilyService } from './family.service';
import { BaseUpdate } from '../base/base.update';
import { ALL_KEYS_MENU_BUTTON_NAME, FAMILY } from '../base-command/base-command.constants';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { ERROR_FOUND_USER } from '../../constants/error.constant';

@Scene(FAMILY.scene)
@UseFilters(TelegrafExceptionFilter)
export class FamilyUpdate extends BaseUpdate {
    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context, @Sender() sender: SenderTelegram) {
        await this.createOrUpdateUserTelegram(sender.first_name, sender.id);
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
            const { text, keyboard } = await this.familyService.getFamilyView(accountId, user.role);
            await ctx.reply(text, keyboard);
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
            const user = await this.familyService.getUserByTelegramId(telegramId);
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

    constructor(private readonly familyService: FamilyService) {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context) {
        await ctx.reply(
            'Пришлите номер аккаунта или номер телефона и имя нового участника через пробел. Например:\n88005555505 Юлия\nИли\nec477d3d-1a13-40b6-a4я7-3fb1984f1106',
        );
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
        const accountIdOwner = await this.familyService.getAccountIdByTelegram(telegramId);

        this.logger.log(`Пользователь ${sender.first_name} - ${sender.id} запросил принять его в семью по accountId ${accountIdOwner}`);

        let namePhoneInvited;
        try {
            namePhoneInvited = await this.familyService.getProfileNamePhone(accountIdInvited);
        } catch (e) {
            if (e instanceof NotFoundException || e instanceof HttpException) {
                throw e;
            }
            await ctx.reply('❌ Что то пошло не так при поиске приглашаемого участника');
            return;
        }
        try {
            await this.familyService.inviteMember(accountIdOwner, namePhoneInvited);
        } catch (e: any) {
            await ctx.reply(e?.message || '❌ Что то пошло не так при добавлении участника');
        }

        await ctx.reply('✅ Приглашение выслано. Проверьте информацию');
        await ctx.scene.leave();

        const user = await this.familyService.getUserByTelegramId(telegramId);
        await ctx.reply('Главное меню', getMainMenuKeyboard(user!.role));
    }

    @On('text')
    async inputFIOInvitedMember(
        @Ctx() ctx: Context,
        @Message('text', new isPhoneNamePipe()) phoneName: PhoneName,
        @Sender() sender: SenderTelegram,
    ) {
        const telegramId = String(sender.id);
        const accountId = await this.familyService.getAccountIdByTelegram(telegramId);

        this.logger.log(
            `Пользователь ${sender.first_name} - ${sender.id} запросил принять его в семью по телефону и имени для accountId ${accountId}`,
        );

        try {
            await this.familyService.inviteMember(accountId, phoneName);
        } catch (e: any) {
            await ctx.reply(e?.message || '❌ Что то пошло не так при добавлении участника');
        }

        await ctx.reply('✅ Приглашение выслано. Проверьте информацию');
        await ctx.scene.leave();

        const user = await this.familyService.getUserByTelegramId(telegramId);
        await ctx.reply('Главное меню', getMainMenuKeyboard(user!.role));
    }
}
