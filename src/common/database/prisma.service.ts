import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { statusHistoryExtension } from '@common/database/prisma.client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    // Основной клиент с адаптером для Prisma 7
    private readonly _baseClient: PrismaClient;

    // Экземпляр с примененными расширениями
    public readonly extended: ReturnType<typeof this.applyExtensions>;

    constructor() {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const adapter = new PrismaPg(pool);
        super({ adapter });

        // 2. Инициализация базового клиента
        this._baseClient = new PrismaClient({ adapter });

        // 3. Применяем расширения
        this.extended = this.applyExtensions(this._baseClient);
    }

    private applyExtensions(client: PrismaClient) {
        return client.$extends(statusHistoryExtension);
    }

    async onModuleInit() {
        await this._baseClient.$connect();
    }

    async onModuleDestroy() {
        await this._baseClient.$disconnect();
    }
}
