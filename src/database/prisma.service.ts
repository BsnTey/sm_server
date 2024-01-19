import { Injectable, OnModuleInit, OnModuleDestroy, INestApplication } from '@nestjs/common';
import {PrismaClient} from '../../../Bot_SM_Nest/prisma/generate';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
