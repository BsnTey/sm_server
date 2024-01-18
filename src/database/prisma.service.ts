import { Injectable, OnModuleInit, OnModuleDestroy, INestApplication } from '@nestjs/common';
import {PrismaClient} from '../../../Bot_SM_Nest/node_modules/@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
