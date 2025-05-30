import { LoggerOptions } from 'pino';
import { BASE_STRATEGY } from './base.strategy';
import { APP_VERSION } from '../../../app.constants';

export const PRODUCTION_STRATEGY: LoggerOptions = {
    ...BASE_STRATEGY,
    formatters: {
        ...BASE_STRATEGY.formatters,
        bindings: () => ({ appVersion: APP_VERSION }),
    },
};
