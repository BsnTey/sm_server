import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AccountService } from '../account/account.service';
import { OrderRepository } from './order.repository';
import { Order } from '@prisma/client';
import { RedisCacheService } from '../cache/cache.service';
import { getOrdersTodayKey } from '../cache/cache.keys';

@Injectable()
export class OrderService {
    private readonly logger = new Logger(OrderService.name);

    constructor(
        private orderRepository: OrderRepository,
        private accountService: AccountService,
        private cacheService: RedisCacheService,
    ) {}

    async getOrder(accountId: string, orderNumber: string) {
        return this.accountService.orderInfo(accountId, orderNumber);
    }

    private async addOrder(accountId: string, orderNumber: string, date: Date = new Date()): Promise<Order> {
        return this.orderRepository.addOrderNumber(accountId, orderNumber, date);
    }

    async findOrderNumber(orderNumber: string) {
        return await this.orderRepository.getOrder(orderNumber);
    }

    async countTodayByAccountIds(accountIds: string[]): Promise<Record<string, number>> {
        if (accountIds.length === 0) return {};

        const cacheKeyMap = new Map<string, string>();
        const redisKeys: string[] = [];

        for (const id of accountIds) {
            const key = getOrdersTodayKey(id);
            cacheKeyMap.set(id, key);
            redisKeys.push(key);
        }

        const cacheResults = await this.cacheService.mget(redisKeys);

        const finalResult: Record<string, number> = {};
        const missingAccountIds: string[] = [];

        accountIds.forEach((accId, index) => {
            const cachedVal = cacheResults[index];
            if (cachedVal !== null) {
                finalResult[accId] = Number(cachedVal);
            } else {
                missingAccountIds.push(accId);
            }
        });

        if (missingAccountIds.length > 0) {
            const dbCounts = await this.orderRepository.countTodayByAccountIds(missingAccountIds);

            const toCache: Record<string, number> = {};

            for (const missingId of missingAccountIds) {
                const count = dbCounts[missingId] || 0;
                finalResult[missingId] = count;

                const key = cacheKeyMap.get(missingId);
                if (key) toCache[key] = count;
            }

            this.cacheService.msetUntilEndOfDay(toCache);
        }

        return finalResult;
    }

    async orderHistory(accountId: string) {
        try {
            const data = await this.accountService.orderHistory(accountId);
            const orders = data?.data?.orders ?? [];
            if (!Array.isArray(orders) || orders.length === 0) return data;

            const byNumber = new Map<string, any>();
            for (const o of orders) {
                if (o?.number) byNumber.set(o.number, o);
            }

            // Парсер ISO-даты из API -> Date | undefined
            const parseOrderDate = (raw: unknown): Date | undefined => {
                if (typeof raw !== 'string') return undefined;
                const d = new Date(raw);
                return isNaN(d.getTime()) ? undefined : d;
            };

            const tasks = Array.from(byNumber.values()).map(async (order: any) => {
                const orderNumber = order?.number as string | undefined;
                if (!orderNumber) return;

                const orderDate = parseOrderDate(order?.date);

                try {
                    await this.addOrder(accountId, orderNumber, orderDate);
                } catch (err) {
                    //ignore
                }
            });

            await Promise.allSettled(tasks);
            const key = getOrdersTodayKey(accountId);
            await this.cacheService.del(key);

            return data;
        } catch (e) {
            throw new BadRequestException('order account error');
        }
    }
}
