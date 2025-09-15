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
    refreshPrivate(account: AccountWithProxyEntity): Promise<any>; // Можно уточнить тип, если refreshPrivate что-то возвращает
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
                // 1. Первая попытка вызова оригинального метода
                return await originalMethod.apply(self, args);
            } catch (error: unknown) {
                // 2. Проверяем, является ли ошибка той, которую мы ожидаем
                if (isAxiosError(error) && error.response?.status === 401 && error.response?.data.error.code === 'UNAUTHORIZED') {
                    logger.warn(`[RetryOn401] Received 401 on method '${methodName}'. Attempting to refresh token and retry...`);
                    const accountId = args[0];
                    if (typeof accountId !== 'string') {
                        logger.error(`[RetryOn401] The first argument of '${methodName}' must be 'accountId' (string). Aborting retry.`);
                        throw error; // Прерываем, если не можем получить accountId
                    }

                    const accountWithProxyEntity = await self.getAccountEntity(accountId);

                    try {
                        await self.refreshPrivate(accountWithProxyEntity);

                        logger.log(`[RetryOn401] Token refreshed for account ${accountId}. Retrying method '${methodName}'...`);

                        // 4. Вторая (и последняя) попытка вызвать оригинальный метод
                        return await originalMethod.apply(self, args);
                    } catch (retryError: unknown) {
                        // Безопасно получаем сообщение об ошибке для логирования
                        const errorMessage = retryError instanceof Error ? retryError.stack : String(retryError);
                        logger.error(
                            `[RetryOn401] Retry failed for accountId ${accountWithProxyEntity.accountId} for method '${methodName}' after token refresh.`,
                            errorMessage,
                        );
                        throw retryError;
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
