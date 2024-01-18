import { Injectable } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AccountService {
    constructor(private prisma: PrismaService) {}

    async createAccount(accountDto: CreateAccountDto): Promise<any | null> {
        await this.prisma.account.create({
            ...accountDto,
            accountId: accountDto.deviceId,
            bonusCount: 0,
        })
      }
}
