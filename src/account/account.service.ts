import { Injectable } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {}

  async createAccount(accountDto: CreateAccountDto): Promise<any | null> {
    return await this.prisma.account.create({
      data: {
        accountId: accountDto.deviceId,
        email: accountDto.email,
        passImap: accountDto.passImap,
        passEmail: accountDto.passEmail,
        cookie: JSON.stringify(accountDto.cookie),
        accessToken: accountDto.accessToken,
        refreshToken: accountDto.refreshToken,
        xUserId: accountDto.xUserId,
        deviceId: accountDto.deviceId,
        installationId: accountDto.installationId,
        expiresIn: accountDto.expiresIn,
        bonusCount: accountDto.bonusCount,
      },
    });
  }
}
