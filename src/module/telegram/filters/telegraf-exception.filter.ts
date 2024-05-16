import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { TelegrafArgumentsHost } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { AccountRepository } from '../../account/account.repository';
import { AxiosError } from 'axios';
import { ERROR_LOGOUT_MP } from '../../account/constants/error.constant';

@Catch()
export class TelegrafExceptionFilter implements ExceptionFilter {
    constructor(private accountRep: AccountRepository) {}

    async catch(exception: Error, host: ArgumentsHost): Promise<void> {
        const telegrafHost = TelegrafArgumentsHost.create(host);
        const ctx = telegrafHost.getContext<Context>();
        if (exception instanceof AxiosError) {
            if (exception.message == 'Socks5 proxy rejected connection - NotAllowed') {
                // Ошибка, когда не создается новый обьект SocksProxyAgent. Исправил, но пусть будет
            } else {
                switch (exception.response!.statusText) {
                    case 'Unauthorized':
                        if (exception.response!.data.error.code == 'UNAUTHORIZED') {
                            const accountId = exception.config!.headers['Account-Id'];
                            // await this.accountRep.setBanMp(accountId);
                            exception.message = ERROR_LOGOUT_MP;
                            break;
                        }
                    case 'Bad Request':
                        if (exception.response!.data.error.code == 'WRONG_TOKEN') {
                            exception.message = ERROR_LOGOUT_MP;
                            const accountId = exception.config!.headers['Account-Id'];
                            await this.accountRep.setBanMp(accountId);
                        }
                        if (exception.response!.data.error.code == 'TOO_MANY_INCORRECT_CODE_INPUTS') {
                            exception.message = exception.response!.data.error.message;
                        }
                        if (exception.response!.data.error.code == 'TOO_MANY_DIFFERENT_PHONES_TO_REQUEST_CODE') {
                            exception.message = exception.response!.data.error.message; //
                        }
                        // exception.message = ERROR_UNKNOWN;
                        exception.message = exception.response!.data.error.message;
                        console.log(exception.response!.data.error.code);
                        console.log(exception.response!.data.error.message);
                        break;
                    default:
                        console.log(exception.message);
                }
            }
        }
        await ctx.replyWithHTML(`<b>❌</b>  ${exception.message}`);
    }
}
