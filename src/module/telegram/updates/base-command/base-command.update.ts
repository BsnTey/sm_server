import { OnModuleInit, UseFilters, UseGuards } from '@nestjs/common';
import { Ctx, Hears, Message, On, Scene, SceneEnter, Start, Update } from 'nestjs-telegraf';
import { BaseUpdate as BaseUpdateExt } from '../base/base.update';
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
    FAMILY,
    FAMILY_ALIAS,
    HELP,
    MAKE_ORDER,
    PROFILE,
    QR_CODE,
    START,
} from './base-command.constants';
import { Context } from '../../interfaces/telegram.context';
import { AdminGuard } from '../admin/admin.guard';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { FAMILY_PRIVELEGIE, FAMILY_USER } from '../../scenes/family.scene';
import { EXTENSION_SCENE } from '../../scenes/profile.scene-constant';

@Update()
@UseFilters(TelegrafExceptionFilter)
export class BaseUpdate {
    @Hears([START.name])
    async onStart(@Ctx() ctx: Context & { startPayload?: string }) {
        await ctx.scene.enter(START.scene);
    }

    @Start()
    async onStartWithParametres(@Ctx() ctx: Context & { startPayload?: string }) {
        if (ctx.startPayload === 'extension') {
            await ctx.scene.enter(EXTENSION_SCENE);
            return;
        }

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

    @Hears([FAMILY.name])
    async onFamily(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(FAMILY_USER);
    }

    @Hears([FAMILY_ALIAS.name])
    async onFamilyAlias(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(FAMILY_PRIVELEGIE);
    }

    @On('text')
    async unknowCommand(@Ctx() ctx: WizardContext) {
        await ctx.reply(`Неизвестная команда. Введите /start`);
    }
}

@Scene(HELP.scene)
@UseFilters(TelegrafExceptionFilter)
export class HelpUpdate extends BaseUpdateExt implements OnModuleInit {
    private shopTg: string;

    onModuleInit() {
        this.shopTg = this.configService.getOrThrow('SHOP_TELEGRAM');
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext) {
        await ctx.reply(`Бот для покупки ${this.shopTg}`);
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }
}
