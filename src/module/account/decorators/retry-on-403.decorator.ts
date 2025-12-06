import { Logger } from '@nestjs/common';
import { isAxiosError } from 'axios';
import { AccountWithProxyEntity } from '../entities/accountWithProxy.entity';
import { RefreshTokensEntity } from '../entities/refreshTokens.entity';

/**
 * Интерфейс для контекста `this`.
 */
interface IRetryableService {
    logger: Logger;
    rawLoadAccountCore(accountId: string): Promise<AccountWithProxyEntity>;
    refreshPrivate(
        account: AccountWithProxyEntity,
    ): Promise<{ refreshTokensEntity: RefreshTokensEntity; accountWithProxy: AccountWithProxyEntity }>;
    swapAccessToken(account: AccountWithProxyEntity): Promise<any>;
}

export function RetryOn401(): MethodDecorator {
    return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const methodName = String(propertyKey);

        descriptor.value = async function (...args: any[]) {
            const self = this as IRetryableService;
            const logger = self.logger || new Logger(`${target.constructor.name}:${methodName}`);

            try {
                // Первая попытка
                return await originalMethod.apply(self, args);
            } catch (error: unknown) {
                // Ловим 401
                if (isAxiosError(error) && error.response?.status === 401 && error.response?.data?.error?.code === 'UNAUTHORIZED') {
                    logger.warn(`[RetryOn401] 401 on '${methodName}'. Will try to refresh and retry.`);

                    const firstArg = args[0];
                    let accountId: string;
                    let accountWithProxy: AccountWithProxyEntity;

                    // 1. Определяем, что пришло: ID (строка) или Entity (объект)
                    if (typeof firstArg === 'string') {
                        accountId = firstArg;
                        accountWithProxy = await self.rawLoadAccountCore(accountId);
                    } else if (typeof firstArg === 'object' && firstArg !== null && 'accountId' in firstArg) {
                        accountWithProxy = firstArg as AccountWithProxyEntity;
                        accountId = accountWithProxy.accountId;
                    } else {
                        logger.error(
                            `[RetryOn401] First argument of '${methodName}' must be accountId (string) or Entity. Aborting retry.`,
                        );
                        throw error;
                    }

                    // --- Попытка №1: refreshPrivate + повтор ---
                    try {
                        const newEntityData = await self.refreshPrivate(accountWithProxy);

                        if (newEntityData) {
                            accountWithProxy = newEntityData.accountWithProxy;

                            if (typeof firstArg !== 'string') {
                                args[0] = accountWithProxy;
                            }
                        }

                        logger.log(`[RetryOn401] Token refreshed for account ${accountId}. Retrying '${methodName}'...`);
                        return await originalMethod.apply(self, args);
                    } catch (refreshErr: unknown) {
                        logger.warn(`[RetryOn401] refreshPrivate() failed for ${accountId}. Trying swapAccessToken()...`);

                        // --- Попытка №2: swapAccessToken + повтор ---
                        try {
                            await self.swapAccessToken(accountWithProxy);

                            const swapAccountWithProxy = await self.rawLoadAccountCore(accountId);

                            const refreshAfterSwap = await self.refreshPrivate(swapAccountWithProxy);

                            if (refreshAfterSwap) {
                                if (typeof firstArg !== 'string') {
                                    args[0] = refreshAfterSwap.accountWithProxy;
                                }
                            }

                            logger.log(`[RetryOn401] swapAccessToken done for ${accountId}. Retrying '${methodName}'...`);
                            return await originalMethod.apply(self, args);
                        } catch (retryAfterSwapErr: unknown) {
                            logger.error(`[RetryOn401] Retry failed for accountId ${accountId} on '${methodName}' after swapAccessToken.`);
                            throw retryAfterSwapErr;
                        }
                    }
                }
                throw error;
            }
        };
        return descriptor;
    };
}
