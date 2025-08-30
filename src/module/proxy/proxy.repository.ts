import { Injectable } from '@nestjs/common';
import { Prisma, Proxy } from '@prisma/client';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class ProxyRepository {
    constructor(private prisma: PrismaService) {}

    async getAllAvailableProxy(currentTime: Date, timeBlockedMinute: number = 5): Promise<Proxy[]> {
        const timeBlockedAgo = new Date();
        timeBlockedAgo.setMinutes(currentTime.getMinutes() - timeBlockedMinute);

        return this.prisma.proxy.findMany({
            where: {
                OR: [{ blockedAt: null }, { blockedAt: { lte: timeBlockedAgo } }],
                expiresAt: {
                    gte: currentTime,
                },
            },
        });
    }

    async list(page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const where: Prisma.ProxyWhereInput = {};

        const [total, items] = await this.prisma.$transaction([
            this.prisma.proxy.count({ where }),
            this.prisma.proxy.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    uuid: true,
                    proxy: true,
                    expiresAt: true,
                },
            }),
        ]);

        return {
            items,
            meta: {
                total,
                page,
                limit,
                pages: Math.max(1, Math.ceil(total / limit)),
            },
        };
    }

    async update(uuid: string, data: Prisma.ProxyUpdateInput) {
        return this.prisma.proxy.update({
            where: { uuid },
            data,
            select: {
                uuid: true,
                proxy: true,
                expiresAt: true,
                blockedAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
}
