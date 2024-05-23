import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TelegrafException, TelegrafExecutionContext } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { NOT_ADMIN, NOT_ADMIN_LIST } from '../../constants/admin.constant';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) {}

    private TELEGRAM_ADMIN_ID: string[] | undefined;

    async canActivate(context: ExecutionContext): Promise<boolean> {
        this.TELEGRAM_ADMIN_ID = this.configService.getOrThrow('TELEGRAM_ADMIN_ID').split(',');
        if (this.TELEGRAM_ADMIN_ID?.length == 0) {
            throw new TelegrafException(NOT_ADMIN_LIST);
        }
        const ctx = TelegrafExecutionContext.create(context);
        const { from } = ctx.getContext<Context>();

        const isAdmin = this.TELEGRAM_ADMIN_ID!.includes(String(from!.id));
        if (!isAdmin) {
            throw new TelegrafException(NOT_ADMIN);
        }

        return true;
    }
}
