import { isAxiosError } from 'axios';

import { Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { IAccountWithProxy } from '../interfaces/account.interface';

export interface IProxyRetryableService {
    logger: Logger;
    cacheManager: Cache;

    accountRep: {
        getAccountWithProxy(accountId: string): Promise<IAccountWithProxy | null>;
    };

    proxyService: {
        updateProxy(uuid: string, dto: { blockedAt?: Date | null }): Promise<any>;
    };
}

interface RetryOnProxyErrorOptions {
    maxAttempts?: number;
    blockMinutes?: number;
}

export function RetryOnProxyError(options: RetryOnProxyErrorOptions = {}): MethodDecorator {
    const { maxAttempts = 5, blockMinutes = 10 } = options;

    return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        const methodName = String(propertyKey);

        descriptor.value = async function (...args: any[]) {
            const self = this as unknown as IProxyRetryableService;

            const logger = self.logger || new Logger(`${target.constructor.name}:${methodName}`);

            const firstArg = args[0] as AccountLike;

            let lastError: any;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    if (attempt > 1) {
                        logger.log(`[RetryOnProxyError] Attempt ${attempt}/${maxAttempts} for '${methodName}'.`);
                    }

                    return await originalMethod.apply(this, args);
                } catch (error: any) {
                    lastError = error;

                    if (!isProxyRelatedError(error)) {
                        throw error;
                    }

                    logger.warn(
                        `[RetryOnProxyError] Proxy-related error on '${methodName}' (attempt ${attempt}/${maxAttempts}): ${
                            error?.message || error
                        }`,
                    );

                    if (attempt >= maxAttempts) {
                        logger.error(`[RetryOnProxyError] Max attempts reached for '${methodName}'. Giving up.`);
                        break;
                    }

                    // --- Пытаемся получить accountId и proxy ---
                    let accountId: string | undefined;
                    let proxyUuid: string | undefined;
                    let proxyStr: string | undefined;

                    try {
                        const ctx = await resolveAccountContext(self, firstArg);
                        accountId = ctx.accountId;
                        proxyUuid = ctx.proxyUuid;
                        proxyStr = ctx.proxyStr;
                    } catch (ctxErr) {
                        logger.error(`[RetryOnProxyError] Failed to resolve account context for '${methodName}':`, ctxErr);
                    }

                    // 1) Блокируем proxy, если есть uuid
                    if (proxyUuid) {
                        try {
                            const blockedAt = new Date();
                            await self.proxyService.updateProxy(proxyUuid, { blockedAt });
                            logger.warn(
                                `[RetryOnProxyError] Proxy blocked (uuid=${proxyUuid}, proxy=${proxyStr ?? ''}), blockedAt=${blockedAt.toISOString()} (~${blockMinutes} min).`,
                            );
                        } catch (blockErr) {
                            logger.error(`[RetryOnProxyError] Failed to block proxy (uuid=${proxyUuid}):`, blockErr);
                        }
                    } else {
                        logger.warn(`[RetryOnProxyError] Proxy uuid not found in context, cannot block proxy.`);
                    }

                    // 2) Чистим кеш по accountId (если он вообще есть)
                    if (accountId) {
                        try {
                            await self.cacheManager.del(accountId);
                            logger.log(`[RetryOnProxyError] Cache cleared for accountId=${accountId}.`);
                        } catch (cacheErr) {
                            logger.error(`[RetryOnProxyError] Failed to clear cache for accountId=${accountId}:`, cacheErr);
                        }
                    } else {
                        logger.warn(`[RetryOnProxyError] accountId not found in context, cannot clear cache.`);
                    }

                    // идём на следующую попытку
                }
            }

            throw lastError;
        };

        return descriptor;
    };
}

type AccountLike =
    | string
    | {
          accountId?: string;
          proxy?: { uuid?: string; proxy?: string | null } | null;
      };

interface AccountContext {
    accountId?: string;
    proxyUuid?: string;
    proxyStr?: string;
}

async function resolveAccountContext(self: IProxyRetryableService, firstArg: AccountLike): Promise<AccountContext> {
    // 1. Если строка — это accountId
    if (typeof firstArg === 'string') {
        const accountId = firstArg;
        const accountWithProxy = await self.accountRep.getAccountWithProxy(accountId);

        return {
            accountId,
            proxyUuid: accountWithProxy?.proxy?.uuid,
            proxyStr: accountWithProxy?.proxy?.proxy ?? undefined,
        };
    }

    // 2. Если объект (AccountWithProxyEntity / IAccountWithProxy / похожий)
    if (firstArg && typeof firstArg === 'object') {
        const obj = firstArg as any;
        const accountId: string | undefined = obj.accountId;

        const proxyUuid: string | undefined = obj.proxy?.uuid;
        const proxyStr: string | undefined = obj.proxy?.proxy ?? undefined;

        // если у объекта есть и accountId, и proxy — можно не ходить в БД
        if (accountId && proxyUuid) {
            return { accountId, proxyUuid, proxyStr };
        }

        // если есть только accountId — дотаскиваем proxy из БД
        if (accountId) {
            const accountWithProxy = await self.accountRep.getAccountWithProxy(accountId);
            return {
                accountId,
                proxyUuid: accountWithProxy?.proxy?.uuid,
                proxyStr: accountWithProxy?.proxy?.proxy ?? undefined,
            };
        }
    }

    return {};
}

function isProxyRelatedError(error: any): boolean {
    if (!error) return false;

    if (isAxiosError(error)) {
        const msg = (error.message || '').toLowerCase();

        if (msg.includes('proxy')) return true;
        if (msg.includes('socks5')) return true;
        if (msg.includes('tunneling socket')) return true;

        if (error.code === 'ECONNABORTED') return true;
        if (error.code === 'ETIMEDOUT') return true;
    }

    if (error instanceof Error && error.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('proxy')) return true;
        if (msg.includes('socks5')) return true;
    }

    if (typeof error === 'string') {
        const msg = error.toLowerCase();
        if (msg.includes('proxy')) return true;
        if (msg.includes('socks5')) return true;
    }

    return false;
}
