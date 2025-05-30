import { LoggerService } from '@nestjs/common';
import koffi from 'koffi';
import pino from 'pino';

export class PinoService implements LoggerService {
    private readonly pino: pino.Logger;

    constructor(strategy: pino.LoggerOptions | pino.Logger) {
        if (process.platform === 'win32') {
            const CP_UTF8 = 65001;
            const kernel32 = koffi.load('Kernel32');
            const setConsoleOutputCP = kernel32.func('SetConsoleOutputCP', 'bool', ['int']);
            const setConsoleCP = kernel32.func('SetConsoleCP', 'bool', ['int']);
            setConsoleOutputCP(CP_UTF8);
            setConsoleCP(CP_UTF8);
        }
        this.pino = pino(strategy);
    }

    public log(message: string, context: string): void {
        this.pino.info({ message, context });
    }

    public error(messageOrError: string | Error, context: string): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let message: string | Record<string, any> = messageOrError;

        if (messageOrError instanceof Error) {
            message = {
                message: messageOrError.message,
                stack: messageOrError.stack,
            };
        }

        this.pino.error({ message, context });
    }

    public warn(message: string, context: string): void {
        this.pino.warn({ message, context });
    }

    public debug(message: string, context: string): void {
        this.pino.debug({ message, context });
    }
}
