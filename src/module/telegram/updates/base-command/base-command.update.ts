import { UseFilters, UseGuards } from '@nestjs/common';
import { Ctx, Hears, Message, Scene, SceneEnter, Update } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import {
    ADMIN,
    ALL_KEYS_MENU_BUTTON_NAME,
    AUTH_MIRROR,
    CALCULATE_BONUS,
    CASH_RECEIPT,
    CHANGE_NUMBER,
    CHECK,
    COOKIE,
    HELP,
    MAKE_ORDER,
    PROFILE,
    QR_CODE,
    START,
} from './base-command.constants';
import { Context } from '../../interfaces/telegram.context';
import { AdminGuard } from '../admin/admin.guard';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { TelegramService } from '../../telegram.service';
import { mainMenuKeyboard } from '../../keyboards/base.keyboard';

@Update()
@UseFilters(TelegrafExceptionFilter)
export class BaseUpdate {
    @Hears([START.name])
    async onStart(@Ctx() ctx: Context) {
        await ctx.scene.enter(START.scene);
    }

    @Hears([ADMIN.name])
    @UseGuards(AdminGuard)
    async onAdminCommand(@Ctx() ctx: Context) {
        await ctx.scene.enter(ADMIN.scene);
    }

    @Hears([CHANGE_NUMBER.name])
    async onStartChangeNumber(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CHANGE_NUMBER.scene);
    }

    @Hears([AUTH_MIRROR.name])
    async onStartMirror(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(AUTH_MIRROR.scene);
    }

    @Hears([MAKE_ORDER.name])
    async onStartOrder(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(MAKE_ORDER.scene);
    }

    @Hears([CHECK.name])
    async onStartChecking(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CHECK.scene);
    }

    @Hears([COOKIE.name])
    async onStartCookie(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(COOKIE.scene);
    }

    @Hears([QR_CODE.name])
    async onStartQrCode(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(QR_CODE.scene);
    }

    @Hears([CASH_RECEIPT.name])
    async onStartCashReceipt(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CASH_RECEIPT.scene);
    }

    @Hears([PROFILE.name])
    async onStartProfile(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(PROFILE.scene);
    }

    @Hears([HELP.name])
    async onStartHelp(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(HELP.scene);
    }

    @Hears([CALCULATE_BONUS.name])
    async onStartCalculate(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CALCULATE_BONUS.scene);
    }
}

@Scene(HELP.scene)
@UseFilters(TelegrafExceptionFilter)
export class HelpUpdate {
    constructor(private telegramService: TelegramService) {}

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply('Обратиться в поддержку можно по ссылке t.me/tpsm_shop', mainMenuKeyboard);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.telegramService.exitScene(menuBtn, ctx);
    }
}
