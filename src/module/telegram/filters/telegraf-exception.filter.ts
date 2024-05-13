import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { TelegrafArgumentsHost } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { AccountRepository } from '../../account/account.repository';
import { AxiosError } from 'axios';
import { ERROR_LOGOUT_MP, ERROR_LOGOUT_MP_BAN } from '../../account/constants/error.constant';

@Catch()
export class TelegrafExceptionFilter implements ExceptionFilter {
    constructor(private accountRep: AccountRepository) {}

    async catch(exception: Error, host: ArgumentsHost): Promise<void> {
        const telegrafHost = TelegrafArgumentsHost.create(host);
        const ctx = telegrafHost.getContext<Context>();
        if (exception instanceof AxiosError) {
            switch (exception.response!.statusText) {
                case 'Unauthorized':
                    const accountId = exception.config!.headers['Account-Id'];
                    await this.accountRep.setBanMp(accountId);
                    exception.message = ERROR_LOGOUT_MP;
                    break;
                case 'Bad Request':
                    exception.message = ERROR_LOGOUT_MP_BAN;
                    break;
                default:
                    console.log(exception.message);
            }
        }
        await ctx.replyWithHTML(`<b>❌</b>  ${exception.message}`);
    }
}
