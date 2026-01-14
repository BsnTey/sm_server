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
export function RetryOnProxyError(options: RetryOnProxyErrorOptions = {}): MethodDecorator {
    const { maxAttempts = 5, minProxyIntervalMs = 450 } = options;

    return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        const methodName = String(propertyKey);

        descriptor.value = async function (...args: any[]) {
            const self = this as unknown as IProxyRetryableService;
            const logger = self.logger || new Logger(`${target.constructor.name}:${methodName}`);

            const originalArg = args[0];
            const isArgObject = typeof originalArg === 'object' && originalArg !== null;

            const accountId = isArgObject ? originalArg.accountId : originalArg;
            let lastError: any;

            let currentProxyUuid: string | undefined = isArgObject ? originalArg.proxy?.uuid : undefined;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    if (attempt > 1) {
                        const freshEntity = await self.getAccountEntity(accountId);

                        currentProxyUuid = freshEntity.proxy?.uuid;

                        if (isArgObject) {
                            args[0] = freshEntity;
                        }
                    }

                    if (currentProxyUuid) {
                        await throttleProxy(currentProxyUuid, minProxyIntervalMs);
                    }

                    if (attempt > 1) {
                        logger.log(`[Retry] Attempt ${attempt}/${maxAttempts}. ProxyUUID: ${currentProxyUuid || 'auto-resolved'}`);
                    }

                    return await originalMethod.apply(this, args);

                } catch (error: any) {
                    lastError = error;

                    if (!isProxyRelatedError(error)) {
                        throw error;
                    }

                    if (attempt >= maxAttempts) break;

                    let proxyUuidToBlock = currentProxyUuid;

                    const key = getAccountEntityKey(accountId);
                    await self.cacheService.del(key);

                    if (!proxyUuidToBlock) {
                        try {
                            const entityInFailState = await self.getAccountEntity(accountId);
                            proxyUuidToBlock = entityInFailState?.proxy?.uuid;
                        } catch (e: any) {
                            logger.warn(`[RetryOnProxyError] Failed to fetch context in catch: ${e.message}`);
                        }
                    }

                    if (proxyUuidToBlock) {
                        try {
                            await self.proxyService.updateProxy(proxyUuidToBlock, { blockedAt: new Date() });
                            logger.warn(`[Retry] Blocked proxy ${proxyUuidToBlock} (attempt ${attempt})`);
                        } catch (e) {
                            logger.error('Failed to block proxy', e);
                        }
                    } else {
                        logger.warn(`[Retry] Could not determine proxy UUID to block for account ${accountId}`);
                    }
                }
            }
            throw lastError;
        };

        return descriptor;
    };
}

// --- 4. Вспомогательные функции ---

function isProxyRelatedError(error: any): boolean {
    if (!error) return false;

    // Собираем сообщение из всех возможных мест
    const msg = (error.message || (typeof error.data === 'string' ? error.data : '') || String(error)).toLowerCase();

    const proxyKeywords = [
        'proxy',
        'socks',
        'tunnel',
        'unreachable',
        'econnrefused',
        'etimedout',
        'econnreset',
        'timeout',
        'failed to do request',
        'handshake failure',
        'connectex',
        'dial tcp',
    ];

    if (proxyKeywords.some(w => msg.includes(w))) return true;

    if (isAxiosError(error)) {
        if (['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ERR_NETWORK'].includes(error.code || '')) return true;
    }

    return false;
}
