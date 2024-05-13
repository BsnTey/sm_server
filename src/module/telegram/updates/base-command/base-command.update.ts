import { UseFilters, UseGuards } from '@nestjs/common';
import { Ctx, Hears, Update } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import {
    ADMIN,
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
        await ctx.reply('admin');
    }

    @Hears([CHANGE_NUMBER.name])
    async onStartChangeNumber(@Ctx() ctx: WizardContext) {
        await ctx.scene.enter(CHANGE_NUMBER.scene);
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
