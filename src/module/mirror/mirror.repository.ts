import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { AccountMirror } from '@prisma/client';

@Injectable()
export class MirrorRepository {
    constructor(private readonly prisma: PrismaService) {}

    async createAccountMirror(telegramId: string, telegramName: string): Promise<AccountMirror> {
        return this.prisma.accountMirror.create({
            data: {
                telegramId,
                telegramName,
            },
        });
    }
    async updateAccountMirror(id: string, data: Partial<AccountMirror>): Promise<AccountMirror | null> {
        return this.prisma.accountMirror.update({
            where: { id },
            data,
        });
    }

    async findAccountMirrorByMirrorToken(mirrorToken: string): Promise<AccountMirror | null> {
        return this.prisma.accountMirror.findUnique({
            where: { mirrorToken },
        });
    }
}
