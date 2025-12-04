import { isAxiosError } from 'axios';
import { Logger } from '@nestjs/common';
import { IAccountWithProxy } from '../interfaces/account.interface';
import { RedisCacheService } from '../../cache/cache.service';
import { getAccountEntityKey } from '../../cache/cache.keys';

// --- 1. Исправленный Троттлер ---

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Храним время (timestamp), когда прокси станет свободным
const proxyAvailability = new Map<string, number>();

/**
 * Гарантирует последовательное выполнение запросов с интервалом.
 * Бронирует слот времени синхронно, предотвращая гонку.
 */
export async function throttleProxy(proxyId: string, minIntervalMs: number) {
    if (!proxyId || minIntervalMs <= 0) return;

    const now = Date.now();

    // 1. Смотрим, когда прокси освободится. Если записи нет или она в прошлом, берем now.
    let scheduledTime = proxyAvailability.get(proxyId) ?? 0;
    if (scheduledTime < now) {
        scheduledTime = now;
    }

    // 2. СРАЗУ обновляем время доступности для СЛЕДУЮЩЕГО запроса.
    // Это происходит синхронно, никто не успеет вклиниться.
    proxyAvailability.set(proxyId, scheduledTime + minIntervalMs);

    // 3. Вычисляем, сколько нужно подождать текущему запросу
    const wait = scheduledTime - now;

    // 4. Ждем своей очереди
    if (wait > 0) {
        await sleep(wait);
    }
}

// --- 2. Интерфейсы ---

export interface IProxyRetryableService {
    logger: Logger;
    cacheService: RedisCacheService;

    getAccountEntity(accountId: string): Promise<IAccountWithProxy>;

    proxyService: {
        updateProxy(uuid: string, dto: { blockedAt?: Date | null }): Promise<any>;
    };
}

interface RetryOnProxyErrorOptions {
    maxAttempts?: number;
    blockMinutes?: number;
    minProxyIntervalMs?: number;
}

// --- 3. Декоратор ---
const PROXY_MIN_INTERVAL_MS = 450; // ~2.2 RPS на прокси

export function RetryOnProxyError(options: RetryOnProxyErrorOptions = {}): MethodDecorator {
    const { maxAttempts = 5, blockMinutes = 60, minProxyIntervalMs = PROXY_MIN_INTERVAL_MS } = options;

    return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        const methodName = String(propertyKey);

        descriptor.value = async function (...args: any[]) {
            const self = this as unknown as IProxyRetryableService;
            const logger = self.logger || new Logger(`${target.constructor.name}:${methodName}`);
            const firstArg = args[0] as AccountLike;

            let lastError: any;

            // Получаем контекст до цикла попыток
            const context = await resolveAccountContext(self, firstArg);

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    // --- Троттлинг ---
                    await throttleProxy(context.proxyUuid, minProxyIntervalMs);

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
                        break;
                    }

                    try {
                        const blockedAt = new Date();
                        await self.proxyService.updateProxy(context.proxyUuid, { blockedAt });
                        logger.warn(`[RetryOnProxyError] Proxy blocked uuid=${context.proxyUuid} for ~${blockMinutes} min.`);
                    } catch (blockErr) {
                        logger.error(`[RetryOnProxyError] Failed to block proxy:`, blockErr);
                    }

                    try {
                        const key = getAccountEntityKey(context.accountId);
                        await self.cacheService.del(key);
                    } catch (cacheErr) {
                        logger.error(`[RetryOnProxyError] Failed to clear cache:`, cacheErr);
                    }
                }
            }
            throw lastError;
        };

        return descriptor;
    };
}

// --- 4. Вспомогательные функции ---

type AccountLike = string | { accountId?: string; proxy?: { uuid?: string; proxy?: string | null } | null };

interface AccountContext {
    accountId: string;
    proxyUuid: string;
    proxyStr: string;
}

async function resolveAccountContext(self: IProxyRetryableService, firstArg: AccountLike): Promise<AccountContext> {
    if (typeof firstArg === 'string') {
        const accountId = firstArg;
        const accountWithProxy = await self.getAccountEntity(accountId);
        return {
            accountId,
            proxyUuid: accountWithProxy.proxy.uuid,
            proxyStr: accountWithProxy?.proxy.proxy,
        };
    }

    if (firstArg && typeof firstArg === 'object') {
        const obj = firstArg as any;
        const accountId: string = obj.accountId;
        const proxyUuid: string = obj.proxy.uuid;
        const proxyStr: string = obj.proxy.proxy;

        return { accountId, proxyUuid, proxyStr };
    }
    throw new Error('Cannot resolve account context from first argument');
}

function isProxyRelatedError(error: any): boolean {
    if (!error) return false;
    if (isAxiosError(error)) {
        const msg = (error.message || '').toLowerCase();
        if (['proxy', 'socks5', 'tunneling socket'].some(w => msg.includes(w))) return true;
        if (['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET'].includes(error.code || '')) return true;
    }
    const msg = (error?.message || String(error)).toLowerCase();
    return msg.includes('proxy') || msg.includes('socks5');
}
