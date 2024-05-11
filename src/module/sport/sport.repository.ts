import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class SportRepository {
    constructor(private readonly prisma: PrismaService) {}
}
