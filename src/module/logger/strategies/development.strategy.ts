import pino from 'pino';
import { BASE_STRATEGY } from './base.strategy';

export const DEVELOPMENT_STRATEGY: pino.LoggerOptions = {
    ...BASE_STRATEGY,
    formatters: {
        ...BASE_STRATEGY.formatters,
        bindings: () => ({}),
    },
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            timestampKey: 'timestamp',
            messageKey: 'message',
        },
    },
};
