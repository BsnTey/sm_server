import { Injectable } from '@nestjs/common';
import { Proxy } from '@prisma/client';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class ProxyRepository {
    constructor(private prisma: PrismaService) {}

    // async addingProxy(proxy: string): Promise<Proxy> {}
    //
    // async deleteAllProxy(proxy: string): Promise<any> {}

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
}
