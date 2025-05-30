import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { TelegrafArgumentsHost } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { AxiosError } from 'axios';
import { ERROR_LOGOUT_MP } from '../../account/constants/error.constant';
import { AccountService } from '../../account/account.service';

@Catch()
export class TelegrafExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(TelegrafExceptionFilter.name);

    constructor(private accountService: AccountService) {}

    async catch(exception: Error, host: ArgumentsHost): Promise<void> {
        const telegrafHost = TelegrafArgumentsHost.create(host);
        const ctx = telegrafHost.getContext<Context>();
        if (exception instanceof AxiosError) {
            if (exception.message == 'Socks5 proxy rejected connection - NotAllowed') {
                exception.message = ERROR_LOGOUT_MP;
            } else {
                if (exception.response) {
                    switch (exception.response.statusText) {
                        case 'Unauthorized':
                            if (exception.response!.data.error.code == 'UNAUTHORIZED') {
                                exception.message = ERROR_LOGOUT_MP;
                                break;
                            }
                        case 'Bad Request':
                            if (exception.response!.data.error.code == 'WRONG_TOKEN') {
                                exception.message = ERROR_LOGOUT_MP;
                                const accountId = exception.config!.headers['Account-Id'];
                                await this.accountService.setBanMp(accountId);
                            }
                            if (exception.response!.data.error.code == 'TOO_MANY_INCORRECT_CODE_INPUTS') {
                                exception.message = exception.response!.data.error.message;
                            }
                            if (exception.response!.data.error.code == 'TOO_MANY_DIFFERENT_PHONES_TO_REQUEST_CODE') {
                                exception.message = exception.response!.data.error.message; //
                            }
                            // exception.message = ERROR_UNKNOWN;
                            exception.message = exception.response!.data.error.message;
                            break;
                        default:
                            this.logger.log(exception.response);
                    }
                } else {
                    this.logger.log('pass');
                }
            }
        }
        this.logger.log(exception.message);
        await ctx.replyWithHTML(`<b>❌</b>  ${exception.message}`);
    }
}
