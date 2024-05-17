import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class CitySMRepository {
    constructor(private prisma: PrismaService) {}
}
