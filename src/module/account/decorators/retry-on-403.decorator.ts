import { Logger } from '@nestjs/common';
import { isAxiosError } from 'axios';
import { AccountWithProxyEntity } from '../entities/accountWithProxy.entity';

/**
 * Определяем интерфейс для контекста `this`.
 * Это гарантирует, что любой сервис, использующий этот декоратор,
 * будет иметь необходимые методы и свойства для его работы.
 */
interface IRetryableService {
    logger: Logger;
    getAccountEntity(accountId: string): Promise<AccountWithProxyEntity>;
    refreshPrivate(account: AccountWithProxyEntity): Promise<any>;
    swapAccessToken(account: AccountWithProxyEntity): Promise<any>;
}

/**
 * Декоратор метода, который перехватывает ошибки Axios с кодом 401 (Forbidden).
 * При возникновении такой ошибки он выполняет логику обновления токена
 * и повторяет вызов исходного метода один раз.
 *
 * @returns {MethodDecorator}
 */
export function RetryOn401(): MethodDecorator {
    // target: Прототип класса (например, AccountService.prototype)
    // propertyKey: Имя метода, которое может быть строкой или символом
    // descriptor: Объект, описывающий свойство (метод)
    return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        // Преобразуем propertyKey в строку для логирования
        const methodName = String(propertyKey);

        // Заменяем оригинальный метод нашей новой функцией-оберткой
        descriptor.value = async function (...args: any[]) {
            // Приводим `this` к нашему интерфейсу, чтобы получить строгую типизацию
            // и доступ к методам с автодополнением.
            const self = this as IRetryableService;

            const logger = self.logger || new Logger(`${target.constructor.name}:${methodName}`);

            try {
                // Первая (обычная) попытка
                return await originalMethod.apply(self, args);
            } catch (error: unknown) {
                // Реагируем только на ожидаемую 401-ошибку Axios
                if (isAxiosError(error) && error.response?.status === 401 && error.response?.data?.error?.code === 'UNAUTHORIZED') {
                    logger.warn(`[RetryOn401] 401 on '${methodName}'. Will try to refresh and retry.`);

                    const accountId = args[0];
                    if (typeof accountId !== 'string') {
                        logger.error(`[RetryOn401] First argument of '${methodName}' must be accountId (string). Aborting retry.`);
                        throw error;
                    }

                    const accountWithProxy = await self.getAccountEntity(accountId);

                    // --- Попытка №1: refreshPrivate + повтор ---
                    try {
                        await self.refreshPrivate(accountWithProxy);
                        logger.log(`[RetryOn401] Token refreshed for account ${accountId}. Retrying '${methodName}'...`);
                        return await originalMethod.apply(self, args);
                    } catch (refreshErr: unknown) {
                        logger.warn(`[RetryOn401] refreshPrivate() failed for ${accountId}. Trying swapAccessToken()...`);

                        // --- Попытка №2: swapAccessToken + повтор ---
                        try {
                            await self.swapAccessToken(accountWithProxy);
                            logger.log(`[RetryOn401] swapAccessToken() done for ${accountId}. Retrying '${methodName}'...`);
                            return await originalMethod.apply(self, args);
                        } catch (retryAfterSwapErr: unknown) {
                            logger.error(
                                `[RetryOn401] Retry failed for accountId ${accountWithProxy.accountId} on '${methodName}' after swapAccessToken.`,
                            );
                            throw retryAfterSwapErr;
                        }
                    }
                }
                // 5. Если это не ошибка 401 от Axios, просто пробрасываем ее дальше
                throw error;
            }
        };
        // Важно вернуть измененный descriptor
        return descriptor;
    };
}
